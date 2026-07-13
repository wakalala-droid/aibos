// The Advisor lives on the homepage now (top-3 inline) with the full list on
// /dashboard/brief?tab=advisor (audit #9). This route survives as a redirect
// so bookmarks and muscle memory keep working.
import { redirect } from 'next/navigation';

export default function AdvisorRedirect() {
  redirect('/dashboard/brief?tab=advisor');
}
