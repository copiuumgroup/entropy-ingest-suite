package tui

import "github.com/charmbracelet/lipgloss"

var (
	// Colors
	PrimaryColor = lipgloss.Color("#00FF9D")
	AccentColor  = lipgloss.Color("#7000FF")
	WhiteColor   = lipgloss.Color("#FFFFFF")
	GrayColor    = lipgloss.Color("#333333")
	LightGray    = lipgloss.Color("#777777")
	BgDeep       = lipgloss.Color("#0A0A0A")
	ErrorColor   = lipgloss.Color("#FF3333")
	YouTubeColor = lipgloss.Color("#FF0000")
	SCColor      = lipgloss.Color("#FF5500")

	// Base Styles
	BaseStyle = lipgloss.NewStyle().
			Padding(1, 2)

	// Header Styles
	HeaderStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true).
			Italic(true).
			Padding(0, 1)

	TitleStyle = lipgloss.NewStyle().
			Foreground(BgDeep).
			Background(PrimaryColor).
			Padding(0, 1).
			Bold(true)

	// Tab Styles
	ActiveTabStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Border(lipgloss.NormalBorder(), false, false, true, false).
			BorderForeground(PrimaryColor).
			Padding(0, 2)

	InactiveTabStyle = lipgloss.NewStyle().
				Foreground(LightGray).
				Border(lipgloss.NormalBorder(), false, false, true, false).
				BorderForeground(GrayColor).
				Padding(0, 2)

	// List Styles
	ItemStyle = lipgloss.NewStyle().
			PaddingLeft(2).
			Foreground(WhiteColor)

	SelectedItemStyle = lipgloss.NewStyle().
				PaddingLeft(2).
				Foreground(PrimaryColor).
				Bold(true)

	SubItemStyle = lipgloss.NewStyle().
			Foreground(LightGray).
			PaddingLeft(4)

	// Status Styles
	StatusStyle = lipgloss.NewStyle().
			Foreground(AccentColor).
			Bold(true)

	HelpStyle = lipgloss.NewStyle().
			Foreground(LightGray).
			Padding(1, 2).
			Border(lipgloss.NormalBorder(), true, false, false, false).
			BorderForeground(GrayColor)

	// Splash Screen
	SplashStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Align(lipgloss.Center)
)
