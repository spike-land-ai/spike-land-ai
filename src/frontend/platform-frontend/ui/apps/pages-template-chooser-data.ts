export type TemplateCategoryId =
  | "basic"
  | "reports"
  | "education"
  | "certificates"
  | "organisers"
  | "newsletters"
  | "brochures"
  | "business"
  | "books"
  | "cards"
  | "posters-flyers"
  | "letters"
  | "curricula-vitae"
  | "stationery"
  | "miscellaneous";

export interface PagesTemplateSeed {
  id: string;
  name: string;
  categories: TemplateCategoryId[];
  premium: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function template(
  name: string,
  categories: TemplateCategoryId[],
  premium = false,
): PagesTemplateSeed {
  return {
    id: slugify(name),
    name,
    categories,
    premium,
  };
}

export const PAGES_TEMPLATE_SEEDS: PagesTemplateSeed[] = [
  template("Blank", ["basic"]),
  template("Blank Layout", ["basic"]),
  template("Blank Landscape", ["basic"]),
  template("Blank Black", ["basic"]),
  template("Note Taking", ["basic"]),

  template("Simple Report", ["reports"]),
  template("Essay", ["reports"]),
  template("Culinary Plain Proposal", ["reports"], true),
  template("Scientific Muted Proposal", ["reports", "education"], true),
  template("Sales Bold Report", ["reports", "business"], true),
  template("Scientific Muted Report", ["reports"], true),
  template("Scrapbook Dark Proposal", ["reports"], true),
  template("Wedding Elegant Proposal", ["reports", "business"], true),
  template("Luxury Elegant Proposal", ["reports"], true),
  template("Educator Playful Proposal", ["reports", "education"], true),
  template("Industrial Proposal", ["reports"], true),
  template("Startup Simple Proposal", ["reports", "business"], true),
  template("Volunteer Colourful Proposal", ["reports"], true),
  template("Community Colourful Report", ["reports"], true),
  template("Travel Colourful Proposal", ["reports"], true),

  template("Educator Playful Planner", ["education", "organisers"], true),
  template("Cyber Stark Organiser", ["education", "organisers"], true),
  template("University Classic Lesson Plan", ["education", "organisers"], true),
  template("Note Taking Colourful Notes", ["education"], true),
  template("Scientific Muted Schedule", ["education", "organisers"], true),
  template("Note Taking Colourful Organiser", ["education", "organisers"], true),
  template("School Simple Lesson Plan", ["education", "organisers"], true),
  template("Note Taking Colourful Schedule", ["education", "organisers"], true),
  template("Educator Playful Organiser", ["education", "organisers"], true),
  template("Cyber Stark Checklist", ["education", "organisers"], true),
  template("Standard Minimalist Note", ["education"], true),
  template("University Classic Report", ["education"], true),
  template("Note Taking Colourful Paper", ["education"], true),

  template("Congratulations Cute Animals", ["certificates"], true),
  template("Blue Banners", ["certificates"], true),
  template("Maths Geometric Achievement", ["certificates"], true),
  template("Green Book Achievement", ["certificates"], true),
  template("Music Notes Achievement", ["certificates"], true),
  template("Course Achievement Certificate", ["certificates"], true),
  template("Pastel Mosaic Banners", ["certificates"], true),
  template("Golden Traditional Congratulations", ["certificates"], true),
  template("Science Certificate", ["certificates"], true),
  template("Fancy Border Achievement", ["certificates"], true),
  template("Teal Shapes", ["certificates"], true),
  template("Athletics Or Activity", ["certificates"], true),
  template("Cream Elegant Music", ["certificates"], true),
  template("Pastel Geometric Shapes", ["certificates"], true),
  template("Purple Gradient Radial", ["certificates"], true),
  template("Science Certificate / Blue Colourful Genesis", ["certificates"], true),
  template("Certificate Of Achievement / Black Geometric Shapes", ["certificates"], true),
  template("School Simple Certificate", ["certificates"], true),
  template("Certificate Of Achievement In Code", ["certificates"], true),
  template("Classic Certificate", ["certificates"], true),

  template("Volunteer Colourful Organiser", ["organisers"], true),
  template("School Simple Checklist", ["organisers"], true),
  template("Recreation Colourful Checklist", ["organisers"], true),
  template("Standard Minimalist Planner", ["organisers"], true),
  template("Family Colourful Chores", ["organisers"], true),
  template("Scrapbook Organiser", ["organisers"], true),

  template("Community Colourful Newsletter", ["newsletters"], true),
  template("Gradient Colourful Newsletter", ["newsletters"], true),
  template("Editorial Colourful Newsletter", ["newsletters"], true),
  template("Academic Modern Newsletter", ["newsletters"], true),
  template("Classic Newsletter", ["newsletters"]),
  template("Journal Newsletter", ["newsletters"]),
  template("Simple Newsletter", ["newsletters"]),
  template("Serif Newsletter", ["newsletters"]),
  template("School Newsletter", ["newsletters"]),

  template("Culinary Plain Catalogue", ["brochures"], true),
  template("School Simple Brochure", ["brochures"]),
  template("Scientific Muted Brochure", ["brochures"], true),
  template("Painting Simple Samples", ["brochures"], true),
  template("Recreation Colourful Brochure", ["brochures"], true),
  template("Sales Bold Brochure", ["brochures"], true),
  template("Photography Bold Contact Sheet", ["brochures"], true),
  template("Educator Playful Brochure", ["brochures"], true),
  template("Gradient Colourful Catalogue", ["brochures"], true),
  template("Elegant Brochure", ["brochures", "miscellaneous"]),
  template("Museum Brochure", ["brochures", "miscellaneous"]),

  template("Photography Bold Invoice", ["business"], true),
  template("Meadow Pastel Invoice", ["business"], true),
  template("Culinary Plain Invoice", ["business"], true),
  template("Branding Modern Report", ["business"], true),
  template("Business Modern Report", ["business"], true),
  template("Branding Modern Plan", ["business"], true),
  template("Industrial Plan", ["business"], true),
  template("Startup Simple Plan", ["business"], true),
  template("Gradient Colourful List", ["business"], true),

  template("Memoir Classic Book", ["books"]),
  template("Travel Photo Book", ["books"], true),
  template("Recipe Scrapbook Book", ["books"], true),

  template("Birthday Minimal Card", ["cards"]),
  template("Thank You Elegant Card", ["cards"], true),
  template("Holiday Mosaic Card", ["cards"], true),

  template("Event Neon Poster", ["posters-flyers"], true),
  template("School Fair Flyer", ["posters-flyers"]),
  template("Gallery Opening Poster", ["posters-flyers"], true),

  template("Formal Cover Letter", ["letters"]),
  template("Personal Letterhead Letter", ["letters"], true),
  template("Business Introduction Letter", ["letters"], true),

  template("Modern Resume", ["curricula-vitae"]),
  template("Classic CV", ["curricula-vitae"]),
  template("Creative Portfolio CV", ["curricula-vitae"], true),

  template("Letterhead Minimal", ["stationery"]),
  template("Meeting Notes Stationery", ["stationery"]),
  template("Executive Memo Stationery", ["stationery"], true),

  template("Invoice", ["miscellaneous"]),
];
