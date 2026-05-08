package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"entropy-cli/tui"
)

func main() {
	p := tea.NewProgram(tui.NewRootModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Alas, there's been an error: %v", err)
		os.Exit(1)
	}
}
