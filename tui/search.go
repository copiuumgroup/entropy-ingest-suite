package tui

import (
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/atotto/clipboard"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/copiuumgroup/entropy-cli/internal/ingest"
)

func isURL(s string) bool {
	s = strings.TrimSpace(s)
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://")
}

func isFilePath(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	_, err := os.Stat(s)
	return err == nil
}

// ResultItem implements list.Item
type ResultItem struct {
	ID         string
	TrackTitle string
	Uploader   string
	URL        string
	Duration   int
}

func (i ResultItem) Title() string       { return i.TrackTitle }
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
	Input       textarea.Model
	List        list.Model
	Spinner     spinner.Model
	Provider    string
	IsSearching bool
	LastError   string
	LastQuery   string
	Keys        SearchKeyMap
	
	// Internal state
	isURLMode bool
}

func NewSearchModel() SearchModel {
	ta := textarea.New()
	ta.Placeholder = "Search, paste URLs (single or batch), or enter a file path..."
	ta.Focus()
	ta.SetWidth(60)
	ta.SetHeight(1) // Starts small, can grow or scroll
	ta.CharLimit = 10000
	ta.FocusedStyle.CursorLine = lipgloss.NewStyle()
	ta.ShowLineNumbers = false
	ta.Prompt = "" // Remove the default prompt character

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
		Input:    ta,
		List:     l,
		Spinner:  sp,
		Provider: "youtube",
		Keys:     SearchKeys(),
	}
}

func (m SearchModel) Init() tea.Cmd {
	return tea.Batch(textarea.Blink, m.Spinner.Tick)
}

func (m SearchModel) Update(msg tea.Msg) (SearchModel, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		// ── Input Focus Handling ─────────────────────────────────────────
		if m.Input.Focused() {
			switch msg.String() {
			case "enter":
				// If it's a single line, we process it. 
				// If the user explicitly wants a newline, they can use Shift+Enter (handled by textarea)
				// but for us, Enter = Submit.
				val := strings.TrimSpace(m.Input.Value())
				if val != "" {
					return m.submit(val)
				}
			case "ctrl+v":
				if text, err := clipboard.ReadAll(); err == nil {
					m.Input.InsertString(text)
					// Auto-expand if multi-line paste
					if strings.Contains(text, "\n") {
						m.Input.SetHeight(5)
					}
					return m, nil
				}
			case "esc":
				m.Input.Blur()
				return m, nil
			case "tab":
				// Tab switches to provider or list? Let's say list.
				m.Input.Blur()
				return m, nil
			}
			
			// Normal typing
			m.Input, cmd = m.Input.Update(msg)
			cmds = append(cmds, cmd)
			
			// Real-time Provider Detection
			val := strings.TrimSpace(m.Input.Value())
			if isURL(val) {
				if strings.Contains(val, "soundcloud.com") {
					m.Provider = "soundcloud"
				} else if strings.Contains(val, "youtube.com") || strings.Contains(val, "youtu.be") {
					m.Provider = "youtube"
				}
			}

			// Dynamic height adjustment
			lines := strings.Count(m.Input.Value(), "\n") + 1
			if lines > 5 { lines = 5 }
			if lines < 1 { lines = 1 }
			m.Input.SetHeight(lines)
			
			return m, tea.Batch(cmds...)
		}

		// ── List Focus Handling ──────────────────────────────────────────
		switch msg.String() {
		case "/", "i":
			m.Input.Focus()
			return m, textarea.Blink
		case "p":
			if m.Provider == "youtube" {
				m.Provider = "soundcloud"
			} else {
				m.Provider = "youtube"
			}
			m.Input.Focus()
			return m, textarea.Blink
		}
		
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)

	case tea.WindowSizeMsg:
		m.Input.SetWidth(msg.Width - 10)
		h, v := BaseStyle.GetFrameSize()
		m.List.SetSize(msg.Width-h, msg.Height-v-10)

	case SearchResultMsg:
		m.IsSearching = false
		if msg.Err != nil {
			m.LastError = msg.Err.Error()
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
			m.LastError = "No results found."
		} else {
			m.LastError = ""
			m.List.Title = fmt.Sprintf("Found %d results", len(items))
		}
		cmd = m.List.SetItems(items)
		cmds = append(cmds, cmd)

	case spinner.TickMsg:
		if m.IsSearching {
			m.Spinner, cmd = m.Spinner.Update(msg)
			cmds = append(cmds, cmd)
		}
	}

	return m, tea.Batch(cmds...)
}

func (m SearchModel) submit(val string) (SearchModel, tea.Cmd) {
	m.LastError = ""
	m.IsSearching = true
	m.Input.Blur()
	m.Input.SetValue("") // Clear after submit
	m.Input.SetHeight(1)
	
	lines := strings.Split(val, "\n")
	var cleanLines []string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l != "" {
			cleanLines = append(cleanLines, l)
		}
	}

	if len(cleanLines) > 1 {
		m.LastQuery = "Batch Import"
		m.isURLMode = true
		return m, tea.Batch(batchFetchCmd(cleanLines), m.Spinner.Tick)
	}

	raw := cleanLines[0]
	m.LastQuery = raw

	if isFilePath(raw) {
		return m, tea.Batch(loadFileCmd(raw), m.Spinner.Tick)
	}

	if isURL(raw) {
		m.isURLMode = true
		if strings.Contains(raw, "soundcloud.com") {
			m.Provider = "soundcloud"
		} else if strings.Contains(raw, "youtube.com") || strings.Contains(raw, "youtu.be") {
			m.Provider = "youtube"
		}
		return m, tea.Batch(fetchInfoCmd(raw), m.Spinner.Tick)
	}

	m.isURLMode = false
	return m, tea.Batch(searchCmd(raw, m.Provider), m.Spinner.Tick)
}

func (m SearchModel) View() string {
	var sb strings.Builder

	// ── Header ────────────────────────────────────────────────────────────
	providerLabel := "YouTube"
	providerColor := YouTubeColor
	if m.Provider == "soundcloud" {
		providerLabel = "SoundCloud"
		providerColor = SCColor
	}
	
	badgeStyle := lipgloss.NewStyle().
		Foreground(WhiteColor).
		Background(providerColor).
		Padding(0, 1).
		Bold(true).
		MarginBottom(1)
	
	inputBorderColor := GrayColor
	if m.Input.Focused() {
		inputBorderColor = PrimaryColor
	}
	
	inputWrapper := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(inputBorderColor).
		Padding(0, 1).
		Width(m.Input.Width() + 2)

	sb.WriteString("\n  " + badgeStyle.Render(" "+providerLabel+" ") + "\n")
	sb.WriteString("  " + inputWrapper.Render(m.Input.View()) + "\n")

	// ── Status/Error ──────────────────────────────────────────────────────
	if m.IsSearching {
		sb.WriteString("  " + m.Spinner.View() + " Processing " + lipgloss.NewStyle().Foreground(PrimaryColor).Render(m.LastQuery) + "...\n")
	} else if m.LastError != "" {
		sb.WriteString("  " + lipgloss.NewStyle().Foreground(ErrorColor).Render("✗ "+m.LastError) + "\n")
	} else {
		hint := lipgloss.NewStyle().Foreground(LightGray).Render("  Enter to submit · p toggle provider · / to focus · Esc to blur")
		sb.WriteString(hint + "\n")
	}

	sb.WriteString("\n")

	// ── Results ───────────────────────────────────────────────────────────
	if len(m.List.Items()) > 0 && !m.IsSearching {
		sb.WriteString(m.List.View())
	} else if !m.IsSearching {
		emptyHint := lipgloss.NewStyle().Foreground(LightGray)
		sb.WriteString("\n\n  " + emptyHint.Render("Ready for your input.") + "\n")
		sb.WriteString("  " + emptyHint.Render("Paste one or more URLs, a file path, or just a song name.") + "\n")
	}

	return sb.String()
}

// Commands
func searchCmd(query, provider string) tea.Cmd {
	return func() tea.Msg {
		results, err := ingest.Search(query, provider)
		if err != nil { return SearchResultMsg{Err: err} }
		return SearchResultMsg{Results: results}
	}
}

func fetchInfoCmd(url string) tea.Cmd {
	return func() tea.Msg {
		results, err := ingest.FetchInfo(url)
		if err != nil { return SearchResultMsg{Err: err} }
		return SearchResultMsg{Results: results, IsURL: true}
	}
}

func loadFileCmd(path string) tea.Cmd {
	return func() tea.Msg {
		urls, err := ingest.ReadURLFile(path)
		if err != nil { return SearchResultMsg{Err: err} }
		return batchFetchCmd(urls)()
	}
}

func batchFetchCmd(urls []string) tea.Cmd {
	return func() tea.Msg {
		var allResults []ingest.Result
		var mu sync.Mutex
		var wg sync.WaitGroup

		for _, u := range urls {
			u = strings.TrimSpace(u)
			if u == "" {
				continue
			}

			wg.Add(1)
			go func(url string) {
				defer wg.Done()
				res, err := ingest.FetchInfo(url)
				if err == nil {
					mu.Lock()
					allResults = append(allResults, res...)
					mu.Unlock()
				}
			}(u)
		}

		wg.Wait()

		if len(allResults) == 0 {
			return SearchResultMsg{Err: fmt.Errorf("no valid tracks found")}
		}
		return SearchResultMsg{Results: allResults, IsURL: true}
	}
}

type SearchResultMsg struct {
	Results []ingest.Result
	Err     error
	IsURL   bool
}
