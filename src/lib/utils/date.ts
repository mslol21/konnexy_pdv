/**
 * Utilitários para formatação e manipulação de datas no fuso horário do Brasil (pt-BR).
 */

export function formatDateBR(dateStringOrDate: string | Date): string {
  if (!dateStringOrDate) return '-';
  const d = typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate) : dateStringOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatDateTimeBR(dateStringOrDate: string | Date): string {
  if (!dateStringOrDate) return '-';
  const d = typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate) : dateStringOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatTimeBR(dateStringOrDate: string | Date): string {
  if (!dateStringOrDate) return '-';
  const d = typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate) : dateStringOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getISOTimestamp(): string {
  return new Date().toISOString();
}
