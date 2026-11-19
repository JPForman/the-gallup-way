import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CorrectionsList, formatCorrectionDate } from "./corrections-list";

describe("CorrectionsList", () => {
  it("renders nothing without corrections", () => {
    const { container } = render(<CorrectionsList corrections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists dated corrections as plain text", () => {
    render(
      <CorrectionsList
        corrections={[
          { id: 1, body: "The fair opens Friday.", created_at: "2026-11-19T18:00:00Z" },
          { id: 2, body: "<b>not bold</b>", created_at: "2026-11-20T18:00:00Z" },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Corrections" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Correction, November 19, 2026");
    expect(items[0]).toHaveTextContent("The fair opens Friday.");
    expect(items[1]).toHaveTextContent("<b>not bold</b>");
  });

  it("formats dates in Gallup's time zone", () => {
    // 03:00 UTC on Nov 20 is still Nov 19 in Mountain Time.
    expect(formatCorrectionDate("2026-11-20T03:00:00Z")).toBe("November 19, 2026");
  });
});
