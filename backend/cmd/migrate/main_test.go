package main

import "testing"

func TestTransactionControlStripped(t *testing.T) {
	sql := "begin;\ncreate table t(id int);\n  COMMIT ;\n-- begin; in a comment stays\n"
	got := transactionControl.ReplaceAllString(sql, "")
	if got != "\ncreate table t(id int);\n\n-- begin; in a comment stays\n" {
		t.Fatalf("unexpected result: %q", got)
	}
}
