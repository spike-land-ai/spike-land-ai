export interface LandingTheme {
  name: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
  };
  typography: {
    fontFamily: string;
    headingWeight: string;
  };
  styles: {
    radius: string;
    glass: boolean;
    flat: boolean;
  };
}
