package tui

import "github.com/charmbracelet/bubbles/key"

// GlobalKeyMap defines keys that work everywhere
type GlobalKeyMap struct {
	Quit     key.Binding
	Help     key.Binding
	NextTab  key.Binding
	PrevTab  key.Binding
	FocusSearch key.Binding
}

// SearchKeyMap defines keys specific to the Search tab
type SearchKeyMap struct {
	ToggleProvider key.Binding
	Enter          key.Binding
	Cancel         key.Binding
}

// ForgeKeyMap defines keys specific to the Forge tab
type ForgeKeyMap struct {
	Cancel key.Binding
}

// VaultKeyMap defines keys specific to the Vault tab
type VaultKeyMap struct {
	Play   key.Binding
	Delete key.Binding
}

func GlobalKeys() GlobalKeyMap {
	return GlobalKeyMap{
		Quit: key.NewBinding(
			key.WithKeys("q", "ctrl+c"),
			key.WithHelp("q/ctrl+c", "quit"),
		),
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "toggle help"),
		),
		NextTab: key.NewBinding(
			key.WithKeys("tab", "right", "l"),
			key.WithHelp("tab/→", "next tab"),
		),
		PrevTab: key.NewBinding(
			key.WithKeys("shift+tab", "left", "h"),
			key.WithHelp("shift+tab/←", "prev tab"),
		),
		FocusSearch: key.NewBinding(
			key.WithKeys("/"),
			key.WithHelp("/", "search"),
		),
	}
}

func SearchKeys() SearchKeyMap {
	return SearchKeyMap{
		ToggleProvider: key.NewBinding(
			key.WithKeys("p"),
			key.WithHelp("p", "toggle provider (yt/sc)"),
		),
		Enter: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "search/download"),
		),
		Cancel: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "cancel/unfocus"),
		),
	}
}

func ForgeKeys() ForgeKeyMap {
	return ForgeKeyMap{
		Cancel: key.NewBinding(
			key.WithKeys("x", "d", "delete"),
			key.WithHelp("x", "cancel download"),
		),
	}
}

func VaultKeys() VaultKeyMap {
	return VaultKeyMap{
		Play: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "play"),
		),
		Delete: key.NewBinding(
			key.WithKeys("x", "d", "delete"),
			key.WithHelp("x", "delete file"),
		),
	}
}
