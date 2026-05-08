package tui

import (
	"fmt"
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
		Inputs: make([]textinput.Model, 5),
		Keys:   SettingsKeys(),
	}

	// Output Dir
	m.Inputs[0] = textinput.New()
	m.Inputs[0].Placeholder = "Output Directory (e.g. ~/Music)"
	m.Inputs[0].Prompt = "  Output Dir: "
	m.Inputs[0].SetValue(config.C.OutputDir)
	m.Inputs[0].Focus()

	// File Format
	m.Inputs[1] = textinput.New()
	m.Inputs[1].Placeholder = "File Format (mp3, flac, opus, m4a, aac)"
	m.Inputs[1].Prompt = "      Format: "
	m.Inputs[1].SetValue(config.C.Quality)

	// Max Concurrent
	m.Inputs[2] = textinput.New()
	m.Inputs[2].Placeholder = "Max Concurrent Downloads"
	m.Inputs[2].Prompt = "  Concurrent: "
	m.Inputs[2].SetValue(strconv.Itoa(config.C.MaxConcurrent))

	// Connections
	m.Inputs[3] = textinput.New()
	m.Inputs[3].Placeholder = "Parallel Connections (aria2c -x)"
	m.Inputs[3].Prompt = " Connections: "
	m.Inputs[3].SetValue(strconv.Itoa(config.C.Connections))

	// Splits
	m.Inputs[4] = textinput.New()
	m.Inputs[4].Placeholder = "File Splits (aria2c -s)"
	m.Inputs[4].Prompt = "      Splits: "
	m.Inputs[4].SetValue(strconv.Itoa(config.C.Splits))

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
	// 1. Output Dir (with tilde expansion)
	outDir := strings.TrimSpace(m.Inputs[0].Value())
	if outDir == "" {
		return fmt.Errorf("output directory cannot be empty")
	}
	config.C.OutputDir = config.ExpandHome(outDir)

	// 2. Format Validation
	validFormats := map[string]bool{
		"mp3": true, "flac": true, "opus": true, "m4a": true, "aac": true, "wav": true,
	}
	format := strings.ToLower(strings.TrimSpace(m.Inputs[1].Value()))
	if !validFormats[format] {
		return fmt.Errorf("unsupported format %q — use: mp3, flac, opus, m4a, aac, wav", format)
	}
	config.C.Quality = format

	// 3. Max Concurrent
	mc, err := strconv.Atoi(strings.TrimSpace(m.Inputs[2].Value()))
	if err != nil || mc <= 0 {
		return fmt.Errorf("concurrent limit must be a positive number")
	}
	config.C.MaxConcurrent = mc

	// 4. Connections
	conn, err := strconv.Atoi(strings.TrimSpace(m.Inputs[3].Value()))
	if err != nil || conn <= 0 {
		return fmt.Errorf("connections must be a positive number")
	}
	config.C.Connections = conn

	// 5. Splits
	splits, err := strconv.Atoi(strings.TrimSpace(m.Inputs[4].Value()))
	if err != nil || splits <= 0 {
		return fmt.Errorf("splits must be a positive number")
	}
	config.C.Splits = splits

	// Update inputs in case tilde was expanded
	m.Inputs[0].SetValue(config.C.OutputDir)

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
