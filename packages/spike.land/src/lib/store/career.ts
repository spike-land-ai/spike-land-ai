import type { AssessmentResult, GeoLocation, UserSkill } from "@/lib/career/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CareerState {
  userSkills: UserSkill[];
  location: GeoLocation | null;
  selectedOccupationUri: string | null;
  assessmentResults: AssessmentResult | null;
  addSkill: (skill: UserSkill) => void;
  removeSkill: (uri: string) => void;
  updateSkillProficiency: (uri: string, proficiency: number) => void;
  setSkills: (skills: UserSkill[]) => void;
  setLocation: (location: GeoLocation) => void;
  setSelectedOccupation: (uri: string | null) => void;
  setAssessmentResults: (results: AssessmentResult) => void;
  reset: () => void;
}

const initialState = {
  userSkills: [] as UserSkill[],
  location: null as GeoLocation | null,
  selectedOccupationUri: null as string | null,
  assessmentResults: null as AssessmentResult | null,
};

export const useCareerStore = create<CareerState>()(
  persist(
    (set) => ({
      ...initialState,
      addSkill: (skill) =>
        set((state) => {
          // Prevent duplicates
          if (state.userSkills.some((s) => s.uri === skill.uri)) {
            return state;
          }
          return { userSkills: [...state.userSkills, skill] };
        }),
      removeSkill: (uri) =>
        set((state) => ({
          userSkills: state.userSkills.filter((s) => s.uri !== uri),
        })),
      updateSkillProficiency: (uri, proficiency) =>
        set((state) => ({
          userSkills: state.userSkills.map((s) => (s.uri === uri ? { ...s, proficiency } : s)),
        })),
      setSkills: (skills) => set({ userSkills: skills }),
      setLocation: (location) => set({ location }),
      setSelectedOccupation: (uri) => set({ selectedOccupationUri: uri }),
      setAssessmentResults: (results) => set({ assessmentResults: results }),
      reset: () => set(initialState),
    }),
    {
      name: "career-assessment",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
