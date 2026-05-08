package tui

import (
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/copiuumgroup/entropy-cli/internal/config"
)

type SettingsModel struct {
	Inputs  []textinput.Model
	Focused int
	Status  string
	Keys    SettingsKeyMap
}

func NewSettingsModel() SettingsModel {
	m := SettingsModel{
		Inputs: make([]textinput.Model, 3),
		Keys:   SettingsKeys(),
	}

	// Output Dir
	m.Inputs[0] = textinput.New()
	m.Inputs[0].Placeholder = "Output Directory"
	m.Inputs[0].Prompt = "  Output Dir: "
	m.Inputs[0].SetValue(config.C.OutputDir)
	m.Inputs[0].Focus()

	// File Format
	m.Inputs[1] = textinput.New()
	m.Inputs[1].Placeholder = "File Format (mp3, flac, opus, m4a)"
	m.Inputs[1].Prompt = "      Format: "
	m.Inputs[1].SetValue(config.C.Quality)

	// Max Concurrent
	m.Inputs[2] = textinput.New()
	m.Inputs[2].Placeholder = "Max Concurrent Downloads"
	m.Inputs[2].Prompt = "  Concurrent: "
	m.Inputs[2].SetValue(strconv.Itoa(config.C.MaxConcurrent))

	return m
}

func (m SettingsModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m SettingsModel) isTyping() bool {
	for _, i := range m.Inputs {
		if i.Focused() {
			return true
		}
	}
	return false
}

func (m SettingsModel) Update(msg tea.Msg) (SettingsModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			m.Inputs[m.Focused].Blur()
			m.Focused--
			if m.Focused < 0 {
				m.Focused = len(m.Inputs) - 1
			}
			m.Inputs[m.Focused].Focus()
			return m, nil

		case "down", "j", "tab":
			m.Inputs[m.Focused].Blur()
			m.Focused++
			if m.Focused >= len(m.Inputs) {
				m.Focused = 0
			}
			m.Inputs[m.Focused].Focus()
			return m, nil

		case "ctrl+s", "enter":
			if err := m.save(); err != nil {
				m.Status = lipgloss.NewStyle().Foreground(ErrorColor).Render("Error: " + err.Error())
			} else {
				m.Status = lipgloss.NewStyle().Foreground(SuccessColor).Render("Settings saved successfully!")
			}
			return m, nil
		}
	}

	for i := range m.Inputs {
		var cmd tea.Cmd
		m.Inputs[i], cmd = m.Inputs[i].Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m *SettingsModel) save() error {
	config.C.OutputDir = strings.TrimSpace(m.Inputs[0].Value())
	config.C.Quality = strings.TrimSpace(m.Inputs[1].Value())
	
	mc, err := strconv.Atoi(strings.TrimSpace(m.Inputs[2].Value()))
	if err == nil && mc > 0 {
		config.C.MaxConcurrent = mc
	}

	return config.Save()
}

func (m SettingsModel) View() string {
	var sb strings.Builder

	sb.WriteString("\n  " + TitleStyle.Render(" APPLICATION SETTINGS ") + "\n\n")

	for i := range m.Inputs {
		sb.WriteString(m.Inputs[i].View() + "\n")
	}

	sb.WriteString("\n  " + m.Status + "\n\n")
	
	hint := lipgloss.NewStyle().Foreground(LightGray).Render("  ↑/↓ to navigate  ·  Enter/Ctrl+S to save  ·  1-4 to switch tabs")
	sb.WriteString(hint + "\n")

	return sb.String()
}
