package tui

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"entropy-cli/internal/ingest"
)

type tab int

const (
	tabSearch tab = iota
	tabForge
	tabVault
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
			}
		}

		// ── Tab cycling: Tab / Shift+Tab ──────────────────────────────────
		if !m.Search.Input.Focused() {
			if key.Matches(msg, m.Keys.NextTab) {
				m.ActiveTab = (m.ActiveTab + 1) % 3
				if m.ActiveTab == tabVault {
					cmds = append(cmds, ScanVaultCmd())
				}
				return m, tea.Batch(cmds...)
			}
			if key.Matches(msg, m.Keys.PrevTab) {
				m.ActiveTab = (m.ActiveTab - 1 + 3) % 3
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
		}
	}

	return m, tea.Batch(cmds...)
}

// startDownload queues a new download for the given result item.
func (m *RootModel) startDownload(item ResultItem) []tea.Cmd {
	newID := len(m.Forge.Downloads)
	ch := make(chan ingest.Progress)

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
		Status:       "Starting...",
		Phase:        "waiting",
		ProgressChan: ch,
	})

	return []tea.Cmd{
		StartDownloadCmd(item.URL, newID, ch),
		WaitForProgressCmd(newID, ch),
		sp.Tick,
	}
}

func (m RootModel) View() string {
	if m.Quitting {
		return "\n  Goodbye.\n"
	}

	if m.ShowSplash {
		splashContent := "\n\n\n\n\n\n\n" +
			TitleStyle.Render(" ENTROPY INGEST SUITE ") + "\n\n" +
			lipgloss.NewStyle().Foreground(LightGray).Render("by copiuum group") + "\n\n\n" +
			lipgloss.NewStyle().Foreground(GrayColor).Render("Press any key to continue...")
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

	tabs := []string{"1 Search", "2 " + downloadLabel, "3 Library"}
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
	}
	helpBox := HelpStyle.Render(helpView)

	// ── Layout ─────────────────────────────────────────────────────────────
	h, v := BaseStyle.GetFrameSize()
	tabH := lipgloss.Height(tabRow)
	helpH := lipgloss.Height(helpBox)
	errH := lipgloss.Height(errorBanner)

	contentH := m.Height - tabH - helpH - errH - v
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
	return []key.Binding{k.ToggleProvider, k.Enter, k.Back}
}
func (k SearchKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.ToggleProvider, k.Enter, k.Back}}
}

func (k ForgeKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Cancel}
}
func (k ForgeKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Cancel}}
}

func (k VaultKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Play, k.Delete}
}
func (k VaultKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Play, k.Delete}}
}
