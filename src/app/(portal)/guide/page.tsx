import { redirect } from 'next/navigation';

/** The tour moved under the secretariat pages: /admin/tour. */
export default function GuidePage(): never {
  redirect('/admin/tour');
}
