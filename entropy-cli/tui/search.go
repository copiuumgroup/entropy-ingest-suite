package tui

import (
	"strings"

	"entropy-cli/internal/ingest"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ResultItem implements list.Item
type ResultItem struct {
	ID         string
	TrackTitle string
	Uploader   string
	URL        string
}

func (i ResultItem) Title() string       { return i.TrackTitle }
func (i ResultItem) Description() string { return i.Uploader }
func (i ResultItem) FilterValue() string { return i.TrackTitle }

type SearchModel struct {
	List        list.Model
	Input       textinput.Model
	Provider    string
	IsSearching bool
	Keys        SearchKeyMap
}

func NewSearchModel() SearchModel {
	ti := textinput.New()
	ti.Placeholder = "Search YouTube or SoundCloud..."
	ti.Focus()
	ti.CharLimit = 156
	ti.Width = 40

	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = delegate.Styles.SelectedTitle.Foreground(PrimaryColor).BorderLeftForeground(PrimaryColor)
	delegate.Styles.SelectedDesc = delegate.Styles.SelectedDesc.Foreground(PrimaryColor).BorderLeftForeground(PrimaryColor)

	l := list.New([]list.Item{}, delegate, 0, 0)
	l.Title = "Results"
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.SetShowHelp(false)

	return SearchModel{
		List:     l,
		Input:    ti,
		Provider: "youtube",
		Keys:     SearchKeys(),
	}
}

func (m SearchModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m SearchModel) Update(msg tea.Msg) (SearchModel, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.Input.Focused() {
			switch msg.String() {
			case "enter":
				if m.Input.Value() != "" {
					query := m.Input.Value()
					m.Input.Blur()
					m.IsSearching = true
					cmds = append(cmds, searchCmd(query, m.Provider))
				}
			case "esc":
				m.Input.Blur()
			}
			m.Input, cmd = m.Input.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		}

		// List focused
		switch msg.String() {
		case "esc", "/":
			m.Input.Focus()
		case "p":
			if m.Provider == "youtube" {
				m.Provider = "soundcloud"
			} else {
				m.Provider = "youtube"
			}
			cmd = m.Input.Focus()
			cmds = append(cmds, cmd)
		}

		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)

	case tea.WindowSizeMsg:
		m.Input.Width = msg.Width - 10
		h, v := BaseStyle.GetFrameSize()
		m.List.SetSize(msg.Width-h, msg.Height-v-10) // Leave room for header/input

	case SearchResultMsg:
		m.IsSearching = false
		var items []list.Item
		for _, res := range msg.Results {
			items = append(items, ResultItem{
				ID:         res.ID,
				TrackTitle: res.Title,
				Uploader:   res.Uploader,
				URL:        res.URL,
			})
		}
		cmd = m.List.SetItems(items)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m SearchModel) View() string {
	var sb strings.Builder

	// Provider Badge
	providerColor := YouTubeColor
	if m.Provider == "soundcloud" {
		providerColor = SCColor
	}
	providerBadge := lipgloss.NewStyle().
		Foreground(WhiteColor).
		Background(providerColor).
		Padding(0, 1).
		Bold(true).
		Render(" " + strings.ToUpper(m.Provider) + " ")

	sb.WriteString("\n" + providerBadge + " " + m.Input.View() + "\n\n")

	if m.IsSearching {
		sb.WriteString(StatusStyle.Render(" Searching Studio Nodes... ") + "\n\n")
	} else if len(m.List.Items()) > 0 {
		sb.WriteString(m.List.View())
	} else {
		sb.WriteString("\n\n" + lipgloss.NewStyle().Foreground(LightGray).Render("   Ready for ingest. Type a query above.") + "\n")
	}

	return sb.String()
}

// SearchResultMsg represents the payload from the ingest engine
type SearchResultMsg struct {
	Results []ingest.Result
}

func searchCmd(query string, provider string) tea.Cmd {
	return func() tea.Msg {
		results, err := ingest.Search(query, provider)
		if err != nil {
			return ErrorMsg{Err: err}
		}
		return SearchResultMsg{Results: results}
	}
}
