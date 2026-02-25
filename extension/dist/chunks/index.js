import{r as l,a as q,g as O}from"./vendor.js";var s={exports:{}},t={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var c;function h(){if(c)return t;c=1;var o=l(),x=Symbol.for("react.element"),v=Symbol.for("react.fragment"),d=Object.prototype.hasOwnProperty,y=o.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,E={key:!0,ref:!0,__self:!0,__source:!0};function R(n,r,f){var e,u={},a=null,p=null;f!==void 0&&(a=""+f),r.key!==void 0&&(a=""+r.key),r.ref!==void 0&&(p=r.ref);for(e in r)d.call(r,e)&&!E.hasOwnProperty(e)&&(u[e]=r[e]);if(n&&n.defaultProps)for(e in r=n.defaultProps,r)u[e]===void 0&&(u[e]=r[e]);return{$$typeof:x,type:n,key:a,ref:p,props:u,_owner:y.current}}return t.Fragment=v,t.jsx=R,t.jsxs=R,t}var _;function j(){return _||(_=1,s.exports=h()),s.exports}var J=j(),i={},m;function k(){if(m)return i;m=1;var o=q();return i.createRoot=o.createRoot,i.hydrateRoot=o.hydrateRoot,i}var C=k();const S=O(C);var b=l();export{S as R,J as j,b as r};
