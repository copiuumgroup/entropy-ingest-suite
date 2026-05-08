package main

import (
	"strings"
	"testing"

	"github.com/copiuumgroup/entropy-cli/tui"

	tea "github.com/charmbracelet/bubbletea"
)

func TestInitialModel(t *testing.T) {
	m := tui.NewRootModel()

	if !m.ShowSplash {
		t.Error("Expected initial model to show splash screen")
	}

	view := m.View()
	if !strings.Contains(view, "ENTROPY INGEST SUITE") {
		t.Errorf("Expected initial view to contain 'ENTROPY INGEST SUITE', got: %s", view)
	}
}

func TestSplashDismissal(t *testing.T) {
	m := tui.NewRootModel()

	// Press any key to dismiss splash
	newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("a")})
	m = newModel.(tui.RootModel)

	if m.ShowSplash {
		t.Error("Expected splash screen to be dismissed after key press")
	}

	view := m.View()
	if !strings.Contains(view, "Search") {
		t.Errorf("Expected view to contain 'Search' tab after dismissing splash, got: %s", view)
	}
}

func TestQuitting(t *testing.T) {
	m := tui.NewRootModel()
	m.ShowSplash = false // Skip splash

	// The search input starts focused (so users can type 'q' without quitting).
	// Pressing Escape blurs the input and returns to browse mode.
	newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = newModel.(tui.RootModel)

	// Pressing 'q' now quits immediately — no two-step confirmation.
	newModel, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	m = newModel.(tui.RootModel)

	if !m.Quitting {
		t.Error("Expected Quitting to be true after pressing 'q'")
	}

	if cmd == nil {
		t.Error("Expected tea.Quit command, got nil")
	}
}
