import { t } from '../../utils/trpc';
import { createAutomodRuleRoute } from './create-rule';
import { deleteAutomodRuleRoute } from './delete-rule';
import { listAutomodRulesRoute } from './list-rules';
import { toggleAutomodRuleRoute } from './toggle-rule';
import { updateAutomodRuleRoute } from './update-rule';

export const automodRouter = t.router({
  createRule: createAutomodRuleRoute,
  updateRule: updateAutomodRuleRoute,
  deleteRule: deleteAutomodRuleRoute,
  listRules: listAutomodRulesRoute,
  toggleRule: toggleAutomodRuleRoute
});
