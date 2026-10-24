#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$DIR/.tools/maven/bin/mvn" ]; then
    exec "$DIR/.tools/maven/bin/mvn" "$@"
else
    exec mvn "$@"
fi
