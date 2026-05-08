package tui

import (
	"context"
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/copiuumgroup/entropy-cli/internal/config"
	"github.com/copiuumgroup/entropy-cli/internal/ingest"
)

type tab int

const (
	tabSearch tab = iota
	tabForge
	tabVault
	tabSettings
)

type ErrorMsg struct {
	Err error
}

type YtDlpUpdateMsg struct {
	Status string
	Err    error
}

type RootModel struct {
	Width      int
	Height     int
	ActiveTab  tab
	Search     SearchModel
	Forge      ForgeModel
	Vault      VaultModel
	Settings   SettingsModel
	Help       help.Model
	Keys       GlobalKeyMap
	Quitting      bool
	ShowSplash    bool
	LastError     string
	BannerIsError bool
}

func NewRootModel() RootModel {
	return RootModel{
		ActiveTab:  tabSearch,
		Search:     NewSearchModel(),
		Forge:      NewForgeModel(),
		Vault:      NewVaultModel(),
		Settings:   NewSettingsModel(),
		Help:       help.New(),
		Keys:       GlobalKeys(),
		ShowSplash: true,
	}
}

func (m RootModel) Init() tea.Cmd {
	return tea.Batch(
		m.Search.Init(),
		m.Forge.Init(),
		m.Vault.Init(),
		m.Settings.Init(),
		TickCmd(),
	)
}

func (m RootModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		// Any key dismisses the splash
		if m.ShowSplash {
			m.ShowSplash = false
			return m, nil
		}

		// Dismiss error banner on any key
		if m.LastError != "" {
			m.LastError = ""
		}

		raw := msg.String()

		// ── QUIT: only q / ctrl+c ──────────────────────────────────────────
		// Never trigger when search input is active (user might type "q")
		if !m.Search.Input.Focused() {
			if key.Matches(msg, m.Keys.Quit) {
				m.Quitting = true
				return m, tea.Quit
			}
		}
		if raw == "ctrl+c" {
			m.Quitting = true
			return m, tea.Quit
		}

		// ── ESC: universal "back to search" ───────────────────────────────
		// Absorb ESC at the root so it never accidentally quits or leaks.
		if raw == "esc" && !m.Search.Input.Focused() {
			m.ActiveTab = tabSearch
			cmd = m.Search.Input.Focus()
			return m, cmd
		}

		// ── Toggle help ────────────────────────────────────────────────────
		if key.Matches(msg, m.Keys.Help) && !m.Search.Input.Focused() {
			m.Help.ShowAll = !m.Help.ShowAll
			return m, nil
		}

		// ── Direct tab jumps: 1 / 2 / 3 ──────────────────────────────────
		if !m.Search.Input.Focused() {
			switch raw {
			case "1":
				m.ActiveTab = tabSearch
				cmd = m.Search.Input.Focus()
				return m, cmd
			case "2":
				m.ActiveTab = tabForge
				return m, nil
			case "3":
				m.ActiveTab = tabVault
				cmds = append(cmds, ScanVaultCmd())
				return m, tea.Batch(cmds...)
			case "4":
				m.ActiveTab = tabSettings
				return m, nil
			}
		}

		// ── Tab cycling: Tab / Shift+Tab ──────────────────────────────────
		if !m.Search.Input.Focused() && !m.Settings.isTyping() {
			if key.Matches(msg, m.Keys.NextTab) {
				m.ActiveTab = (m.ActiveTab + 1) % 4
				if m.ActiveTab == tabVault {
					cmds = append(cmds, ScanVaultCmd())
				}
				return m, tea.Batch(cmds...)
			}
			if key.Matches(msg, m.Keys.PrevTab) {
				m.ActiveTab = (m.ActiveTab - 1 + 4) % 4
				if m.ActiveTab == tabVault {
					cmds = append(cmds, ScanVaultCmd())
				}
				return m, tea.Batch(cmds...)
			}
			// / focuses search from anywhere
			if key.Matches(msg, m.Keys.FocusSearch) {
				m.ActiveTab = tabSearch
				cmd = m.Search.Input.Focus()
				return m, cmd
			}

			// U triggers yt-dlp update
			if key.Matches(msg, m.Keys.Update) {
				m.LastError = "Updating yt-dlp... please wait."
				m.BannerIsError = false
				return m, UpdateYtDlpCmd()
			}
		}

	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		m.Help.Width = msg.Width

		m.Search, cmd = m.Search.Update(msg)
		cmds = append(cmds, cmd)
		m.Forge, cmd = m.Forge.Update(msg)
		cmds = append(cmds, cmd)
		m.Vault, cmd = m.Vault.Update(msg)
		cmds = append(cmds, cmd)
		m.Settings, cmd = m.Settings.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)

	case TickMsg:
		cmds = append(cmds, TickCmd())

	case ErrorMsg:
		m.LastError = msg.Err.Error()
		m.BannerIsError = true

	case YtDlpUpdateMsg:
		if msg.Err != nil {
			m.LastError = "Update failed: " + msg.Err.Error()
			m.BannerIsError = true
		} else {
			m.LastError = msg.Status
			m.BannerIsError = false
		}

	// Route download messages to Forge regardless of active tab
	case DownloadProgressMsg, DownloadDoneMsg, DownloadErrorMsg:
		m.Forge, cmd = m.Forge.Update(msg)
		cmds = append(cmds, cmd)
		if _, ok := msg.(DownloadDoneMsg); ok {
			cmds = append(cmds, ScanVaultCmd())
		}
	}

	// Route remaining messages to the active tab
	if !m.ShowSplash {
		switch m.ActiveTab {
		case tabSearch:
			m.Search, cmd = m.Search.Update(msg)
			cmds = append(cmds, cmd)

			// When Enter is pressed on a list item → start download
			if keyMsg, ok := msg.(tea.KeyMsg); ok {
				if key.Matches(keyMsg, m.Search.Keys.Enter) && !m.Search.Input.Focused() {
					if item, ok := m.Search.List.SelectedItem().(ResultItem); ok {
						cmds = append(cmds, m.startDownload(item)...)
						m.ActiveTab = tabForge
					}
				}
			}

		case tabForge:
			m.Forge, cmd = m.Forge.Update(msg)
			cmds = append(cmds, cmd)

		case tabVault:
			m.Vault, cmd = m.Vault.Update(msg)
			cmds = append(cmds, cmd)

		case tabSettings:
			m.Settings, cmd = m.Settings.Update(msg)
			cmds = append(cmds, cmd)
		}
	}

	return m, tea.Batch(cmds...)
}

// startDownload queues a new download for the given result item.
func (m *RootModel) startDownload(item ResultItem) []tea.Cmd {
	newID := len(m.Forge.Downloads)
	ch := make(chan ingest.Progress)
	ctx, cancel := context.WithCancel(context.Background())
	_ = ctx // context available for future use in engine

	sp := spinner.New()
	sp.Spinner = spinner.Dot
	sp.Style = lipgloss.NewStyle().Foreground(PrimaryColor)

	prog := progress.New(
		progress.WithDefaultGradient(),
		progress.WithWidth(40),
	)

	m.Forge.Downloads = append(m.Forge.Downloads, Download{
		ID:           newID,
		URL:          item.URL,
		Title:        item.TrackTitle,
		Spinner:      sp,
		Progress:     prog,
		Status:       "Queued...",
		Phase:        "waiting",
		ProgressChan: ch,
		Cancel:       cancel,
	})

	activeCount := 0
	for _, d := range m.Forge.Downloads {
		if d.Phase == "downloading" || d.Phase == "processing" {
			activeCount++
		}
	}

	if activeCount < config.C.MaxConcurrent {
		m.Forge.Downloads[newID].Phase = "downloading"
		m.Forge.Downloads[newID].Status = "Starting..."
		return []tea.Cmd{
			StartDownloadCmd(item.URL, newID, ch, cancel),
			WaitForProgressCmd(newID, ch),
			sp.Tick,
		}
	}

	return []tea.Cmd{sp.Tick}
}

// showConfig appends a one-line config summary to the info banner.
func configSummary() string {
	return fmt.Sprintf("Output: %s  ·  Format: %s  ·  Limit: %d  ·  Conn: %d",
		config.C.OutputDir, config.C.Quality, config.C.MaxConcurrent, config.C.Connections)
}

func (m RootModel) View() string {
	if m.Quitting {
		return "\n  Goodbye.\n"
	}

	if m.ShowSplash {
		noticeStyle := lipgloss.NewStyle().Foreground(LightGray).Italic(true)
		disclaimerStyle := lipgloss.NewStyle().Foreground(GrayColor).Align(lipgloss.Center)

		splashContent := lipgloss.JoinVertical(lipgloss.Center,
			TitleStyle.Render(" ENTROPY INGEST SUITE "),
			"",
			noticeStyle.Render("by copiuum group"),
			"",
			"",
			lipgloss.NewStyle().Foreground(PrimaryColor).Render("The UI is fast. The downloads are faster."),
			"",
			disclaimerStyle.Render("NOTICE: This is a personal labor of love."),
			disclaimerStyle.Render("The developers are not responsible for data loss,"),
			disclaimerStyle.Render("hardware fire, or accidental nuclear escalation."),
			"",
			"",
			lipgloss.NewStyle().Foreground(GrayColor).Render("Press any key to enter the void..."),
		)
		return lipgloss.Place(m.Width, m.Height, lipgloss.Center, lipgloss.Center, splashContent)
	}

	// ── Tab bar ────────────────────────────────────────────────────────────
	downloadLabel := "Downloads"
	activeCount := 0
	for _, d := range m.Forge.Downloads {
		if d.Phase == "downloading" || d.Phase == "processing" || d.Phase == "waiting" {
			activeCount++
		}
	}
	if activeCount > 0 {
		downloadLabel = fmt.Sprintf("Downloads (%d active)", activeCount)
	} else if len(m.Forge.Downloads) > 0 {
		downloadLabel = fmt.Sprintf("Downloads (%d)", len(m.Forge.Downloads))
	}

	tabs := []string{"1 Search", "2 " + downloadLabel, "3 Library", "4 Settings"}
	var renderedTabs []string
	for i, t := range tabs {
		if i == int(m.ActiveTab) {
			renderedTabs = append(renderedTabs, ActiveTabStyle.Render(t))
		} else {
			renderedTabs = append(renderedTabs, InactiveTabStyle.Render(t))
		}
	}
	tabRow := lipgloss.NewStyle().PaddingTop(1).Render(
		lipgloss.JoinHorizontal(lipgloss.Top, renderedTabs...),
	)

	// ── Error banner ───────────────────────────────────────────────────────
	var errorBanner string
	if m.LastError != "" {
		bannerColor := ErrorColor
		icon := "✗ "
		if !m.BannerIsError {
			bannerColor = AccentColor
			icon = "ℹ "
		}

		errorBanner = lipgloss.NewStyle().
			Foreground(WhiteColor).
			Background(bannerColor).
			Bold(true).
			Padding(0, 2).
			Width(m.Width).
			Render(icon + " " + m.LastError + "  (any key to dismiss)") + "\n"
	}

	// ── Content ────────────────────────────────────────────────────────────
	var content string
	switch m.ActiveTab {
	case tabSearch:
		content = m.Search.View()
	case tabForge:
		content = m.Forge.View()
	case tabVault:
		content = m.Vault.View()
	case tabSettings:
		content = m.Settings.View()
	}

	// ── Help footer ────────────────────────────────────────────────────────
	var helpView string
	switch m.ActiveTab {
	case tabSearch:
		helpView = m.Help.View(m.Search.Keys)
	case tabForge:
		helpView = m.Help.View(m.Forge.Keys)
	case tabVault:
		helpView = m.Help.View(m.Vault.Keys)
	case tabSettings:
		helpView = m.Help.View(m.Settings.Keys)
	}
	helpBox := HelpStyle.Render(helpView)

	confLine := lipgloss.NewStyle().
		Foreground(GrayColor).
		Italic(true).
		Padding(0, 2).
		Render(configSummary())

	// ── Layout ─────────────────────────────────────────────────────────────
	h, v := BaseStyle.GetFrameSize()
	tabH := lipgloss.Height(tabRow)
	helpH := lipgloss.Height(helpBox)
	errH := lipgloss.Height(errorBanner)
	confH := lipgloss.Height(confLine)

	contentH := m.Height - tabH - helpH - errH - confH - v
	if contentH < 10 {
		contentH = 10
	}

	contentBox := lipgloss.NewStyle().
		Width(m.Width - h).
		Height(contentH).
		Render(content)

	ui := lipgloss.JoinVertical(lipgloss.Left,
		tabRow,
		errorBanner,
		BaseStyle.Render(contentBox),
		confLine,
		helpBox,
	)

	return lipgloss.Place(m.Width, m.Height, lipgloss.Left, lipgloss.Top, ui)
}

// TickMsg / TickCmd for periodic re-renders.
type TickMsg time.Time

func TickCmd() tea.Cmd {
	return tea.Every(time.Millisecond*100, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

func UpdateYtDlpCmd() tea.Cmd {
	return func() tea.Msg {
		status, err := ingest.UpdateYtDlp()
		return YtDlpUpdateMsg{Status: status, Err: err}
	}
}

// help.KeyMap implementations

func (k SearchKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Focus, k.Enter, k.ToggleProvider}
}
func (k SearchKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Focus, k.Enter, k.ToggleProvider, k.Back}}
}

func (k ForgeKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Cancel, k.Retry}
}
func (k ForgeKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Up, k.Down, k.Cancel, k.Retry}}
}

func (k VaultKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Delete, k.Sort, k.Refresh}
}
func (k VaultKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Delete, k.Sort, k.Refresh}}
}

func (k SettingsKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Save}
}
func (k SettingsKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Up, k.Down, k.Save}}
}
