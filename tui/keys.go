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
	Tab4        key.Binding
	FocusSearch key.Binding
	Update      key.Binding
}

// SearchKeyMap defines keys for the Search tab.
type SearchKeyMap struct {
	ToggleProvider key.Binding
	Enter          key.Binding
	Back           key.Binding
	Focus          key.Binding
}

// ForgeKeyMap defines keys for the Downloads tab.
type ForgeKeyMap struct {
	Cancel key.Binding
	Retry  key.Binding
	Up     key.Binding
	Down   key.Binding
}

// VaultKeyMap defines keys for the Music Library tab.
type VaultKeyMap struct {
	Delete  key.Binding
	Sort    key.Binding
	Refresh key.Binding
}

// SettingsKeyMap defines keys for the Settings tab.
type SettingsKeyMap struct {
	Up    key.Binding
	Down  key.Binding
	Enter key.Binding
	Save  key.Binding
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
		Tab4: key.NewBinding(
			key.WithKeys("4"),
			key.WithHelp("4", "Settings"),
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
			key.WithHelp("p", "toggle provider"),
		),
		Enter: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "submit"),
		),
		Back: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "blur"),
		),
		Focus: key.NewBinding(
			key.WithKeys("/", "i"),
			key.WithHelp("/", "focus input"),
		),
	}
}

func ForgeKeys() ForgeKeyMap {
	return ForgeKeyMap{
		Cancel: key.NewBinding(
			key.WithKeys("x", "delete"),
			key.WithHelp("x", "cancel selected"),
		),
		Retry: key.NewBinding(
			key.WithKeys("r"),
			key.WithHelp("r", "retry failed"),
		),
		Up: key.NewBinding(
			key.WithKeys("up", "k"),
			key.WithHelp("↑/k", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("down", "j"),
			key.WithHelp("↓/j", "down"),
		),
	}
}

func VaultKeys() VaultKeyMap {
	return VaultKeyMap{
		Delete: key.NewBinding(
			key.WithKeys("x", "delete"),
			key.WithHelp("x", "delete file"),
		),
		Sort: key.NewBinding(
			key.WithKeys("s"),
			key.WithHelp("s", "cycle sort"),
		),
		Refresh: key.NewBinding(
			key.WithKeys("r"),
			key.WithHelp("r", "refresh library"),
		),
	}
}
func SettingsKeys() SettingsKeyMap {
	return SettingsKeyMap{
		Up: key.NewBinding(
			key.WithKeys("up", "k"),
			key.WithHelp("↑/k", "prev field"),
		),
		Down: key.NewBinding(
			key.WithKeys("down", "j", "tab"),
			key.WithHelp("↓/j/tab", "next field"),
		),
		Enter: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "edit"),
		),
		Save: key.NewBinding(
			key.WithKeys("ctrl+s"),
			key.WithHelp("ctrl+s", "save changes"),
		),
	}
}
