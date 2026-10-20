import {createHmac} from 'node:crypto';
import {Data,Lingering,visible} from './engine.mjs';
import Projection from '../src/pvp-projection.js';
export const project=Projection.create({Data,Lingering,visible,opaque:(room,viewer,uid)=>'h_'+createHmac('sha256',room.secret).update(`${viewer}:${room.revision}:${uid}`).digest('base64url').slice(0,22)});
