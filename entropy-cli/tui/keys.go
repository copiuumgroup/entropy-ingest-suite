package tui

import "github.com/charmbracelet/bubbles/key"

// GlobalKeyMap defines keys that work everywhere.
type GlobalKeyMap struct {
	Quit        key.Binding
	Help        key.Binding
	NextTab     key.Binding
	PrevTab     key.Binding
	Tab1        key.Binding
	Tab2        key.Binding
	Tab3        key.Binding
	FocusSearch key.Binding
	Update      key.Binding
}

// SearchKeyMap defines keys for the Search tab.
type SearchKeyMap struct {
	ToggleProvider key.Binding
	Enter          key.Binding
	Back           key.Binding
}

// ForgeKeyMap defines keys for the Downloads tab.
type ForgeKeyMap struct {
	Cancel key.Binding
}

// VaultKeyMap defines keys for the Music Library tab.
type VaultKeyMap struct {
	Play   key.Binding
	Delete key.Binding
}

func GlobalKeys() GlobalKeyMap {
	return GlobalKeyMap{
		Quit: key.NewBinding(
			key.WithKeys("q", "ctrl+c"),
			key.WithHelp("q", "quit"),
		),
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "help"),
		),
		NextTab: key.NewBinding(
			key.WithKeys("tab", "right"),
			key.WithHelp("tab/→", "next tab"),
		),
		PrevTab: key.NewBinding(
			key.WithKeys("shift+tab", "left"),
			key.WithHelp("shift+tab/←", "prev tab"),
		),
		Tab1: key.NewBinding(
			key.WithKeys("1"),
			key.WithHelp("1", "Search"),
		),
		Tab2: key.NewBinding(
			key.WithKeys("2"),
			key.WithHelp("2", "Downloads"),
		),
		Tab3: key.NewBinding(
			key.WithKeys("3"),
			key.WithHelp("3", "Library"),
		),
		FocusSearch: key.NewBinding(
			key.WithKeys("/"),
			key.WithHelp("/", "new search"),
		),
		Update: key.NewBinding(
			key.WithKeys("U"),
			key.WithHelp("U", "update yt-dlp"),
		),
	}
}

func SearchKeys() SearchKeyMap {
	return SearchKeyMap{
		ToggleProvider: key.NewBinding(
			key.WithKeys("p"),
			key.WithHelp("p", "YouTube / SoundCloud"),
		),
		Enter: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "search / download selected"),
		),
		Back: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "back to search box"),
		),
	}
}

func ForgeKeys() ForgeKeyMap {
	return ForgeKeyMap{
		Cancel: key.NewBinding(
			key.WithKeys("x", "delete"),
			key.WithHelp("x", "cancel download"),
		),
	}
}

func VaultKeys() VaultKeyMap {
	return VaultKeyMap{
		Play: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "open file"),
		),
		Delete: key.NewBinding(
			key.WithKeys("x", "delete"),
			key.WithHelp("x", "delete file"),
		),
	}
}
