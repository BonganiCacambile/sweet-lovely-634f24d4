import { defineMcp } from "@lovable.dev/mcp-js";
import getMenuTool from "./tools/get-menu";

export default defineMcp({
  name: "sweet-n-lovely-mcp",
  title: "Sweet & Lovely Pizza",
  version: "0.1.0",
  instructions:
    "Tools for the Sweet & Lovely Pizza site. Use `get_menu` to fetch the public menu of categories and active products with prices in ZAR.",
  tools: [getMenuTool],
});