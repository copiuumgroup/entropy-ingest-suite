package main

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"entropy-cli/tui"
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

	// Step 1: Request quit
	newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	m = newModel.(tui.RootModel)

	if !m.ConfirmQuit {
		t.Error("Expected ConfirmQuit to be true after pressing 'q'")
	}

	view := m.View()
	if !strings.Contains(view, "Are you sure you want to exit?") {
		t.Errorf("Expected view to contain quit prompt, got: %s", view)
	}

	// Step 2: Confirm quit
	newModel, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("y")})
	m = newModel.(tui.RootModel)

	if !m.Quitting {
		t.Error("Expected quitting to be true after pressing 'y'")
	}

	if cmd == nil {
		t.Error("Expected tea.Quit command, got nil")
	}
}
