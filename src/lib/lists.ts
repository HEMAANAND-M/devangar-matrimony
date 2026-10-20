import "server-only";
import { getSetting } from "./settings";

/**
 * Dropdown options members pick from. Admins edit them in Admin → Settings; these defaults are a
 * starting point used until then.
 */
export const LIST_DEFAULTS = {
  gothrams: [
    "Agasthiya", "Atreya", "Bharadwaja", "Gautama", "Harita", "Jamadagni", "Kashyapa", "Kaundinya",
    "Markandeya", "Mudgala", "Parashara", "Shandilya", "Srivatsa", "Vasishta", "Vishwamitra",
  ],
  subSects: ["Telugu Devanga", "Kannada Devanga", "Tamil Devanga", "Devanga Chettiar", "Devanga Setty", "Jaandra"],
  cities: [
    "Coimbatore", "Tiruppur", "Erode", "Salem", "Chennai", "Madurai", "Bengaluru", "Hosur", "Karur", "Namakkal",
    "Komarapalayam", "Rasipuram", "Somanur", "Dindigul", "Theni", "Andipatti", "Virudhunagar", "Tirunelveli",
    "Mysuru", "Hyderabad",
  ],
  education: [
    "Doctorate", "Master's – Engineering", "Master's – Arts & Science", "MBA", "Medicine (MBBS / MD)",
    "Bachelor's – Engineering", "Bachelor's – Arts & Science", "Chartered Accountant", "Law", "Diploma",
    "Higher secondary", "Other",
  ],
  occupations: [
    "Software professional", "Engineer", "Doctor", "Teacher / Lecturer", "Government service", "Banking & finance",
    "Business owner", "Textile & weaving business", "Chartered accountant", "Lawyer", "Private company", "Farmer",
    "Not working", "Other",
  ],
};
export type Lists = typeof LIST_DEFAULTS;
export type ListKey = keyof Lists;

export async function getLists(): Promise<Lists> {
  const saved = await getSetting<Partial<Lists>>("lists", {});
  return { ...LIST_DEFAULTS, ...saved };
}
