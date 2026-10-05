package store

import "testing"

func TestCalculateOverallRating(t *testing.T) {
	tests := []struct {
		name    string
		ratings []int
		want    int
	}{
		{"all five", []int{5, 5, 5, 5}, 5},
		{"rounds to nearest", []int{5, 4, 4, 4}, 4},
		{"mixed", []int{1, 2, 4, 5}, 3},
		{"empty", nil, 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := CalculateOverallRating(test.ratings...); got != test.want {
				t.Fatalf("got %d, want %d", got, test.want)
			}
		})
	}
}
