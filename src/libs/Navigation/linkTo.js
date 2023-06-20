import {getActionFromState} from '@react-navigation/core';
import _ from 'lodash';
import NAVIGATORS from '../../NAVIGATORS';
import linkingConfig from './linkingConfig';
import getTopmostReportId from './getTopmostReportId';
import getStateFromPath from './getStateFromPath';

/**
 * Find minimal action for RHP.
 * This is necessary because getActionFromState doesn't take into consideration current navigation state.
 * That means that even if we want to open profile screen and the settings flow is currently opened, the target will be RHPNavigator and the payload will include whole structure.
 * That causes unexpected behaviour when clicking browser back in some of the RHP flows.
 *
 * To avoid that we are looking for the smallest possible action. In this case it will be push profile screen and the target will be the settings navigator.
 *
 * @param {Object} action action generated by getActionFromState
 * @param {Object} state root state
 * @returns {{minimalAction: Object, targetName: String}} minimal action is the action that we should dispatch and targetName is the name of the target navigator.
 * targetName name is necessary to determine if we are going to use REPLACE for navigating between RHP flows.
 */
function getMinimalAction(action, state) {
    let currentAction = action;
    let currentState = state;
    let currentTargetKey = null;
    let targetName = null;

    while (currentState.routes[currentState.index].name === currentAction.payload.name) {
        targetName = currentState.routes[currentState.index].name;
        currentState = currentState.routes[currentState.index].state;

        currentTargetKey = currentState.key;
        // Creating new smaller action
        currentAction = {
            type: currentAction.type,
            payload: {
                name: currentAction.payload.params.screen,
                params: currentAction.payload.params.params,
            },
            target: currentTargetKey,
        };
    }
    return {minimalAction: currentAction, targetName};
}

export default function linkTo(navigation, path, type) {
    if (navigation === undefined) {
        throw new Error("Couldn't find a navigation object. Is your component inside a screen in a navigator?");
    }

    let root = navigation;
    let current;

    // Traverse up to get the root navigation
    // eslint-disable-next-line no-cond-assign
    while ((current = root.getParent())) {
        root = current;
    }

    const state = getStateFromPath(path);

    const action = getActionFromState(state, linkingConfig.config);

    // If action type is different than NAVIGATE we can't change it to the PUSH safely
    if (action.type === 'NAVIGATE') {
        // If this action is navigating to the report screen and the top most navigator is different from the one we want to navigate - PUSH
        if (action.payload.name === NAVIGATORS.CENTRAL_PANE_NAVIGATOR && getTopmostReportId(root.getState()) !== getTopmostReportId(state)) {
            action.type = 'PUSH';

            // If the type is UP, we deeplinked into one of the RHP flows and we want to replace the current screen with the previous one in the flow
            // and at the same time we want the back button to go to the page we were before the deeplink
        } else if (type === 'UP') {
            action.type = 'REPLACE';

            // If this action is navigating to the RightModalNavigator and the last route on the root navigator is not RightModalNavigator then push
        } else if (action.payload.name === NAVIGATORS.RIGHT_MODAL_NAVIGATOR && _.last(root.getState().routes).name !== NAVIGATORS.RIGHT_MODAL_NAVIGATOR) {
            action.type = 'PUSH';
        }
    }

    // We want to look for minimal action only for RHP screens
    if (action.payload.name === NAVIGATORS.RIGHT_MODAL_NAVIGATOR) {
        const {minimalAction, targetName} = getMinimalAction(action, navigation.getRootState());
        if (minimalAction) {
            // If the target name is RHP that means this action is responsible for changing flow within the RHP e.g. from settings to search. In that case we want to use REPLACE.
            if (targetName === NAVIGATORS.RIGHT_MODAL_NAVIGATOR) {
                minimalAction.type = 'REPLACE';
            }
            root.dispatch(minimalAction);
            return;
        }
    }

    if (action !== undefined) {
        root.dispatch(action);
    } else {
        root.reset(state);
    }
}
