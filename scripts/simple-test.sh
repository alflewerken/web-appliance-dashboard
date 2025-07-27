#!/bin/bash
echo "Test: Anzahl Argumente: $#"
echo "Alle Argumente:"
for arg in "$@"; do
    echo "  - '$arg'"
done
echo ""
echo "Warte auf Eingabe..."
read
