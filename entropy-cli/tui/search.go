package tui

import (
	"fmt"
	"strings"

	"entropy-cli/internal/ingest"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

func isURL(s string) bool {
	s = strings.TrimSpace(s)
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://")
}

// ResultItem implements list.Item
type ResultItem struct {
	ID         string
	TrackTitle string
	Uploader   string
	URL        string
	Duration   int
}

func (i ResultItem) Title() string { return i.TrackTitle }
func (i ResultItem) Description() string {
	if i.Duration > 0 {
		mins := i.Duration / 60
		secs := i.Duration % 60
		return fmt.Sprintf("%s  ·  %d:%02d", i.Uploader, mins, secs)
	}
	return i.Uploader
}
func (i ResultItem) FilterValue() string { return i.TrackTitle }

type SearchModel struct {
	IsURLMode   bool
	List        list.Model
	Input       textinput.Model
	Spinner     spinner.Model
	Provider    string
	IsSearching bool
	LastError   string
	LastQuery   string
	Keys        SearchKeyMap
}

func NewSearchModel() SearchModel {
	ti := textinput.New()
	ti.Placeholder = "Search for a song, artist, or paste a URL..."
	ti.Focus()
	ti.CharLimit = 500
	ti.Width = 40

	sp := spinner.New()
	sp.Spinner = spinner.Dot
	sp.Style = lipgloss.NewStyle().Foreground(PrimaryColor)

	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = delegate.Styles.SelectedTitle.
		Foreground(PrimaryColor).
		BorderLeftForeground(PrimaryColor)
	delegate.Styles.SelectedDesc = delegate.Styles.SelectedDesc.
		Foreground(SecondaryColor).
		BorderLeftForeground(PrimaryColor)

	l := list.New([]list.Item{}, delegate, 0, 0)
	l.Title = "Search Results"
	l.SetShowStatusBar(true)
	l.SetFilteringEnabled(false)
	l.SetShowHelp(false)
	l.Styles.Title = lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Padding(0, 1)

	return SearchModel{
		List:     l,
		Input:    ti,
		Spinner:  sp,
		Provider: "youtube",
		Keys:     SearchKeys(),
	}
}

func (m SearchModel) Init() tea.Cmd {
	return tea.Batch(textinput.Blink, m.Spinner.Tick)
}

func (m SearchModel) Update(msg tea.Msg) (SearchModel, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.Input.Focused() {
			switch msg.String() {
			case "enter":
				raw := strings.TrimSpace(m.Input.Value())
				if raw != "" {
					m.LastQuery = raw
					m.LastError = ""
					m.Input.Blur()
					m.IsSearching = true
					if isURL(raw) {
						m.IsURLMode = true
						cmds = append(cmds, fetchInfoCmd(raw))
					} else {
						m.IsURLMode = false
						cmds = append(cmds, searchCmd(raw, m.Provider))
					}
					cmds = append(cmds, m.Spinner.Tick)
				}
				// Don't pass Enter to the textinput itself — we consumed it
				return m, tea.Batch(cmds...)
			case "esc":
				// ESC while typing → blur input; root model handles global ESC
				m.Input.Blur()
				return m, nil
			}
			m.Input, cmd = m.Input.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		}

		// ── List is focused ──────────────────────────────────────────────
		switch msg.String() {
		case "/":
			// / always refocuses the search box
			m.Input.Focus()
			cmds = append(cmds, textinput.Blink)
			return m, tea.Batch(cmds...)
		case "p":
			if m.Provider == "youtube" {
				m.Provider = "soundcloud"
			} else {
				m.Provider = "youtube"
			}
			m.Input.Focus()
			cmds = append(cmds, textinput.Blink)
			return m, tea.Batch(cmds...)
		}
		// Note: ESC is handled at root level, so we don't handle it here.
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)

	case tea.MouseMsg:
		// Pass mouse events to the list so scroll and clicks work
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)

	case spinner.TickMsg:
		if m.IsSearching {
			m.Spinner, cmd = m.Spinner.Update(msg)
			cmds = append(cmds, cmd)
		}

	case tea.WindowSizeMsg:
		m.Input.Width = msg.Width - 16
		h, v := BaseStyle.GetFrameSize()
		// Leave room for input row + hint row + padding
		m.List.SetSize(msg.Width-h, msg.Height-v-8)

	case SearchResultMsg:
		m.IsSearching = false
		if msg.Err != nil {
			if m.IsURLMode {
				m.LastError = "Could not load URL: " + msg.Err.Error()
			} else {
				m.LastError = "Search failed: " + msg.Err.Error()
			}
			break
		}
		var items []list.Item
		for _, res := range msg.Results {
			items = append(items, ResultItem{
				ID:         res.ID,
				TrackTitle: res.Title,
				Uploader:   res.Uploader,
				URL:        res.URL,
				Duration:   res.Duration,
			})
		}
		if len(items) == 0 {
			m.LastError = fmt.Sprintf("No results found for %q — try different keywords.", m.LastQuery)
		} else {
			m.LastError = ""
			if msg.IsURL {
				if len(items) == 1 {
					m.List.Title = "Track found — select and press Enter to download"
				} else {
					m.List.Title = fmt.Sprintf("Playlist — %d tracks  (↑↓ to browse, Enter to download)", len(items))
				}
			} else {
				m.List.Title = fmt.Sprintf("Results for %q — %d found  (↑↓ browse, Enter download)", m.LastQuery, len(items))
			}
		}
		cmd = m.List.SetItems(items)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m SearchModel) View() string {
	var sb strings.Builder

	// ── Provider badge + input ────────────────────────────────────────────
	providerLabel := "YouTube"
	providerColor := YouTubeColor
	if m.Provider == "soundcloud" {
		providerLabel = "SoundCloud"
		providerColor = SCColor
	}
	badge := lipgloss.NewStyle().
		Foreground(WhiteColor).
		Background(providerColor).
		Padding(0, 1).
		Bold(true).
		Render(" " + providerLabel + " ")

	sb.WriteString("\n" + badge + " " + m.Input.View() + "\n")

	// ── Contextual hint bar ───────────────────────────────────────────────
	hintStyle := lipgloss.NewStyle().Foreground(LightGray)
	if m.Input.Focused() {
		sb.WriteString(hintStyle.Render("  Enter to search  ·  Paste a URL to download directly  ·  p to switch provider") + "\n\n")
	} else if !m.IsSearching {
		sb.WriteString(hintStyle.Render("  / to search  ·  ↑↓ to browse  ·  Enter to download  ·  Tab/1·2·3 to switch tabs") + "\n\n")
	} else {
		sb.WriteString("\n")
	}

	// ── Body ──────────────────────────────────────────────────────────────
	if m.IsSearching {
		var label string
		if m.IsURLMode {
			label = m.Spinner.View() + " Fetching track info..."
		} else {
			label = m.Spinner.View() + " Searching " + providerLabel + " for " + fmt.Sprintf("%q", m.LastQuery) + "..."
		}
		sb.WriteString("  " + lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true).Render(label) + "\n")
	} else if m.LastError != "" {
		sb.WriteString("\n  " + lipgloss.NewStyle().Foreground(ErrorColor).Bold(true).Render("✗  "+m.LastError) + "\n")
	} else if len(m.List.Items()) > 0 {
		sb.WriteString(m.List.View())
	} else {
		sb.WriteString("\n\n  " + hintStyle.Render("Type a song name or artist and press Enter to search.") + "\n")
		sb.WriteString("  " + hintStyle.Render("Paste a YouTube or SoundCloud URL and press Enter to download directly.") + "\n")
	}

	return sb.String()
}

// SearchResultMsg is sent by searchCmd / fetchInfoCmd.
type SearchResultMsg struct {
	Results []ingest.Result
	Err     error
	IsURL   bool
}

func searchCmd(query string, provider string) tea.Cmd {
	return func() tea.Msg {
		results, err := ingest.Search(query, provider)
		if err != nil {
			return SearchResultMsg{Err: err}
		}
		return SearchResultMsg{Results: results}
	}
}

func fetchInfoCmd(url string) tea.Cmd {
	return func() tea.Msg {
		results, err := ingest.FetchInfo(url)
		if err != nil {
			return SearchResultMsg{Err: err}
		}
		return SearchResultMsg{Results: results, IsURL: true}
	}
}
