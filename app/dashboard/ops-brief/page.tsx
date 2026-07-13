// The Ops brief is a tab on the Briefs page now (audit #9). This route
// survives as a redirect so bookmarks and muscle memory keep working.
import { redirect } from 'next/navigation';

export default function OpsBriefRedirect() {
  redirect('/dashboard/brief?tab=ops');
}
