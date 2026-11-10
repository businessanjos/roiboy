/** Regras de "processo concluído" dos Processos CS Eternum. */

/** Concluído quando o processo tem etapas e todas estão marcadas como feitas. */
export function isProcessFinished(allKeys: string[], done: (key: string) => boolean): boolean {
  return allKeys.length > 0 && allKeys.every((k) => done(k));
}

/** A marcação desta etapa é o que fecha o processo agora? */
export function finishesProcess(
  allKeys: string[],
  doneKeys: Set<string>,
  hubDone: Set<string>,
  key: string,
): boolean {
  if (!allKeys.includes(key) || doneKeys.has(key) || hubDone.has(key)) return false;
  return allKeys.every((k) => doneKeys.has(k) || hubDone.has(k) || k === key);
}
