'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Mail, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import { whatsappLink } from '@/lib/leads';

type Channel = {
  key: string;
  label: string;
  value: string;
  href: string;
  icon: React.ElementType;
  external?: boolean;
};

export function OutreachCards({
  initialMessage,
  email,
  phone,
  country,
  website,
  profileUrl,
}: {
  initialMessage: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  website?: string | null;
  profileUrl?: string | null;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const channels = useMemo<Channel[]>(() => {
    const text = encodeURIComponent(message);
    const list: Channel[] = [];

    if (email) {
      list.push({
        key: 'email',
        label: 'Email',
        value: email,
        href: `mailto:${email}?subject=${encodeURIComponent('Quick idea for your team')}&body=${text}`,
        icon: Mail,
      });
    }

    const wa = whatsappLink(phone, country, message);
    if (wa) {
      list.push({
        key: 'whatsapp',
        label: 'WhatsApp',
        value: phone ?? '',
        href: wa,
        icon: MessageCircle,
        external: true,
      });
    }

    if (phone) {
      list.push({
        key: 'phone',
        label: 'Phone',
        value: phone,
        href: `tel:${phone.replace(/\s+/g, '')}`,
        icon: Phone,
      });
    }

    if (profileUrl) {
      list.push({
        key: 'profile',
        label: 'Profile',
        value: profileUrl.replace(/^https?:\/\//, '').slice(0, 48),
        href: profileUrl,
        icon: ExternalLink,
        external: true,
      });
    }

    if (website) {
      list.push({
        key: 'website',
        label: 'Website',
        value: website.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 48),
        href: website,
        icon: ExternalLink,
        external: true,
      });
    }

    return list;
  }, [message, email, phone, country, website, profileUrl]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Draft message</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMessage(initialMessage)}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              title="Reset to generated draft"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          spellCheck={false}
          className="mt-3 min-h-[190px] flex-1 resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm leading-relaxed text-zinc-200 outline-none focus:border-zinc-600"
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Contact channel</h2>
        {channels.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-sm text-zinc-500">
            No contact method found.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/80">
            {channels.map(({ key, label, value, href, icon: Icon, external }) => (
              <li key={key} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-zinc-200">{label}</span>
                  {value && (
                    <span className="block truncate text-xs text-zinc-500">{value}</span>
                  )}
                </span>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  {key === 'email'
                    ? 'Send email'
                    : key === 'whatsapp'
                      ? 'Open WhatsApp'
                      : key === 'phone'
                        ? 'Call'
                        : 'Open'}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
