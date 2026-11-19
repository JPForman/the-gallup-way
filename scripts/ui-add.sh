#!/usr/bin/env bash
# Add shadcn/ui components, then undo the CLI's switch to the "cn" package:
# we use clsx + tailwind-merge via @/lib/utils (see CLAUDE.md).
set -euo pipefail
pnpm dlx shadcn@3.5.0 add "$@" -y
sed -i.bak 's#from "cn"#from "@/lib/utils"#' src/components/ui/*.tsx && rm -f src/components/ui/*.bak
if grep -q '"cn":' package.json; then pnpm remove cn; fi
