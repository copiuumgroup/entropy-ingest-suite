package ingest

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// ReadURLFile reads a plain-text file containing one URL per line.
// Lines that are blank or begin with '#' are ignored.
// Returns an error if the file cannot be opened.
func ReadURLFile(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("cannot open URL file %q: %w", path, err)
	}
	defer f.Close()

	var urls []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		urls = append(urls, line)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading URL file: %w", err)
	}
	return urls, nil
}
