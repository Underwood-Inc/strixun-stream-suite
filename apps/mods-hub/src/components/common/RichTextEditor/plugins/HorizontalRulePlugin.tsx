/**
 * HorizontalRulePlugin
 * Registers the horizontal rule insert command
 * Replacement for deprecated @lexical/react/LexicalHorizontalRulePlugin
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { INSERT_HORIZONTAL_RULE_COMMAND, $createHorizontalRuleNode } from '@lexical/extension';

export function HorizontalRulePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_HORIZONTAL_RULE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const hrNode = $createHorizontalRuleNode();
          $insertNodes([hrNode]);
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}

export default HorizontalRulePlugin;
