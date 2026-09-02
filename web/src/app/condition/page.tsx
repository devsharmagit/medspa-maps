import { redirect } from "next/navigation";

// `/condition` (like `/treatment`) points at the Patients' Favourites page.
export default function ConditionIndexRedirect() {
  redirect("/patients-favourites");
}
