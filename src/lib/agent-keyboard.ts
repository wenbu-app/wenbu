type ComposerKey = {
  key: string;
  keyCode?: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
};

export function shouldSendMessage(key: ComposerKey, touchKeyboard: boolean): boolean {
  if (key.key !== 'Enter' || key.isComposing || key.keyCode === 229 || key.shiftKey) return false;
  return key.ctrlKey || key.metaKey || !touchKeyboard;
}
