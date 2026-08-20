export interface Presentation {
  id: string;
  title: string;
  shortTitle: string;
  file: string;
  type: "pdf" | "webpage";
}

export const PRESENTATIONS: Presentation[] = [
  {
    id: "presentation-01",
    title: "Brand Presentation",
    shortTitle: "Brand Presentation",
    file: "/presentation-01.pdf",
    type: "pdf",
  },
  {
    id: "presentation-02",
    title: "Logo & Brand Experience",
    shortTitle: "Logo & Brand Experience",
    file: "",
    type: "webpage",
  },
];
