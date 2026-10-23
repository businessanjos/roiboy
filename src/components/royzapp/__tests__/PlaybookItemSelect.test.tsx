import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaybookItemSelect } from '../PlaybookItemSelect';
import type { PlaybookItem } from '@/hooks/usePlaybook';

// Radix Popover/Command depend on pointer + scroll APIs the jsdom lacks.
if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false;
if (!(Element.prototype as any).setPointerCapture) (Element.prototype as any).setPointerCapture = () => {};
if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {};
if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {};
// cmdk mede a lista com ResizeObserver, que o jsdom não traz.
if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
}

const mk = (id: string, name: string, content_type = 'text') =>
  ({ id, account_id: 'a1', folder_id: null, name, content_type, text_content: 'oi', position: 0 }) as PlaybookItem;

const ITEMS = [
  mk('1', 'Apresentação Darlan'),
  mk('2', 'Follow up - NO SHOW'),
  mk('3', 'Apresentação Jota - Curta'),
];

/** Item conta como visível quando existe e nenhum ancestral está com hidden (cmdk filtra assim). */
function isShown(name: string) {
  return screen.getAllByText(name, { exact: false }).some((el) => !el.closest('[hidden]'));
}

function open() {
  fireEvent.click(screen.getByRole('combobox'));
}

describe('PlaybookItemSelect', () => {
  it('abre uma lista com barra de busca', () => {
    render(<PlaybookItemSelect items={ITEMS} value="" onChange={() => {}} onCreate={() => {}} />);
    expect(screen.getByText('Selecione uma mensagem')).toBeInTheDocument();
    open();
    expect(screen.getByPlaceholderText('Buscar mensagem...')).toBeInTheDocument();
    expect(isShown('Apresentação Darlan')).toBe(true);
    expect(isShown('Follow up - NO SHOW')).toBe(true);
  });

  it('filtra as mensagens pelo que foi digitado', () => {
    render(<PlaybookItemSelect items={ITEMS} value="" onChange={() => {}} onCreate={() => {}} />);
    open();
    fireEvent.change(screen.getByPlaceholderText('Buscar mensagem...'), { target: { value: 'apre' } });
    expect(isShown('Apresentação Darlan')).toBe(true);
    expect(isShown('Apresentação Jota - Curta')).toBe(true);
    expect(isShown('Follow up - NO SHOW')).toBe(false);

    fireEvent.change(screen.getByPlaceholderText('Buscar mensagem...'), { target: { value: 'jota' } });
    expect(isShown('Apresentação Jota - Curta')).toBe(true);
    expect(isShown('Apresentação Darlan')).toBe(false);
  });

  it('mostra aviso quando nada corresponde à busca', () => {
    render(<PlaybookItemSelect items={ITEMS} value="" onChange={() => {}} onCreate={() => {}} />);
    open();
    fireEvent.change(screen.getByPlaceholderText('Buscar mensagem...'), { target: { value: 'zzzz' } });
    expect(screen.getByText('Nenhuma mensagem encontrada.')).toBeInTheDocument();
  });

  it('devolve o id da mensagem escolhida', () => {
    const onChange = vi.fn();
    render(<PlaybookItemSelect items={ITEMS} value="" onChange={onChange} onCreate={() => {}} />);
    open();
    fireEvent.change(screen.getByPlaceholderText('Buscar mensagem...'), { target: { value: 'darlan' } });
    const item = screen.getByText('Apresentação Darlan').closest('[cmdk-item]') as HTMLElement;
    fireEvent.click(item);
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('mantém o atalho de nova mensagem na lista', () => {
    const onCreate = vi.fn();
    render(<PlaybookItemSelect items={ITEMS} value="" onChange={() => {}} onCreate={onCreate} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Nova mensagem…' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
