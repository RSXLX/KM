import { redirect } from 'next/navigation';

export default function BetsRedirectPage() {
  redirect('/account/positions');
}