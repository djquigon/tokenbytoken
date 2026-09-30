// Every scene the walkthrough can show, as one union keyed by `stage` and `view`.

import type { ContextScene } from './context/build';
import type { FollowupScene } from './followup/build';
import type { LoopScene } from './loop/build';
import type { NetworkScene } from './network/build';
import type { ProbsScene } from './probs/build';
import type { SampleScene } from './sample/build';
import type { TokenizeScene } from './tokenize/build';

export type Scene = ProbsScene | ContextScene | TokenizeScene | NetworkScene | SampleScene | LoopScene | FollowupScene;

export type SceneOf<S extends Scene['stage'], V extends string> = Extract<Scene, { stage: S; view: V }>;
