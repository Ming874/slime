import type { Metadata } from 'next';
import AdminApp from '@/components/admin/AdminApp';
import './admin.css';

export const metadata: Metadata = { title: '允許名單管理｜史萊姆捏捏工坊', robots: { index: false } };

export default function AdminPage() {
  return <AdminApp />;
}
