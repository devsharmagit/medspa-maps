import { redirect } from "next/navigation";

// The Patients' Favourites index now lives at /patients-favourites; /treatment points to it.
export default function TreatmentIndexRedirect() {
  redirect("/patients-favourites");
}
