import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { CARD_LIST } = require('../src/cards.js');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'assets/art');
await mkdir(destination, { recursive: true });

// Hand-authored vector illustrations: editable paths, no downloaded images.
const palettes = {
  'blue-eyes': ['#dcf5ff', '#86bcd3', '#294d75', '#6fdfff', '#0c283d'],
  alexandrite: ['#fff1f2', '#dd93ae', '#714576', '#ffbcd7', '#341c45'],
  'luster-dragon': ['#abe5ff', '#498eba', '#233566', '#77d8ff', '#0b2440'],
  'spear-dragon': ['#ebec9d', '#9dab59', '#455b3b', '#ddff97', '#123934'],
  'thunder-dragon': ['#fff2ad', '#c29d4a', '#6a5840', '#ffe77c', '#252644'],
  'curse-dragon': ['#eacc8a', '#ad8846', '#533d42', '#ffba52', '#291e34'],
  'ultimate-dragon': ['#e7f8ff', '#9dc7df', '#416d9f', '#9addff', '#172943'],
  'twin-thunder': ['#fff0a0', '#e0af38', '#795941', '#ffe879', '#342e40'],
  'dragon-champion': ['#eac88d', '#aa843f', '#50423f', '#ffcb7a', '#28392f']
};
function random(seed) { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function atmosphere(accent, seed = 17) {
  const r = random(seed);
  let shapes = '<circle cx="300" cy="278" r="232" fill="none" stroke="' + accent + '" stroke-opacity=".2"/><circle cx="300" cy="278" r="218" fill="none" stroke="' + accent + '" stroke-opacity=".09" stroke-width="8"/><circle cx="300" cy="278" r="199" fill="none" stroke="' + accent + '" stroke-opacity=".14" stroke-dasharray="2 14"/>';
  for (let i = 0; i < 48; i++) {
    const x = Math.round(r() * 600), y = Math.round(r() * 600), radius = (r() * 1.5 + .4).toFixed(1);
    shapes += '<circle cx="' + x + '" cy="' + y + '" r="' + radius + '" fill="' + accent + '" opacity="' + (.15 + r() * .55).toFixed(2) + '"/>';
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 25.714 * Math.PI / 180, x = 300 + Math.cos(a) * 224, y = 278 + Math.sin(a) * 224;
    shapes += '<path d="M-4-8V8M-7-3L7 3M-5 8L4-8" fill="none" stroke="' + accent + '" opacity=".4" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (i * 25.714) + ')"/>';
  }
  return shapes;
}
function wrap(content, colors, seed = 5, decoration = true) {
  const [light, medium, dark, accent, bg] = colors;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs>' +
    '<radialGradient id="bg"><stop stop-color="' + dark + '"/><stop offset="1" stop-color="' + bg + '"/></radialGradient>' +
    '<linearGradient id="body" x1=".1" y1="0" x2=".8" y2="1"><stop stop-color="' + light + '"/><stop offset=".43" stop-color="' + medium + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
    '<linearGradient id="metal" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="' + light + '"/><stop offset=".34" stop-color="' + medium + '"/><stop offset=".55" stop-color="' + light + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
    '<linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + accent + '" stop-opacity=".64"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
    '<radialGradient id="orb"><stop stop-color="#fff"/><stop offset=".22" stop-color="' + light + '"/><stop offset=".52" stop-color="' + accent + '"/><stop offset="1" stop-color="' + accent + '" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="' + bg + '" stop-opacity="0"/><stop offset="1" stop-color="' + bg + '" stop-opacity=".86"/></linearGradient>' +
    '<filter id="glow" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="7"/></filter>' +
    '<filter id="smallglow" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="2"/></filter>' +
    '</defs><rect width="600" height="600" fill="url(#bg)"/>' +
    (decoration ? atmosphere(accent, seed) : '') +
    '<ellipse cx="300" cy="557" rx="253" ry="43" fill="' + accent + '" opacity=".09"/>' + content +
    '<rect width="600" height="600" fill="url(#shade)"/><g fill="' + accent + '" opacity=".5"><circle cx="108" cy="461" r="2"/><circle cx="478" cy="372" r="2.5"/><circle cx="419" cy="98" r="1.5"/></g></svg>';
}
const dragonHead = '<g stroke="#253f5b" stroke-width="3" stroke-linejoin="round"><path d="M316 282C324 239 337 217 373 194L401 175 447 200 463 225 514 247 498 267 457 268 439 293 407 277 379 286 362 332Z" fill="url(#body)"/><path d="M372 200L359 148 397 181 410 128 428 187 455 170 447 207" fill="url(#metal)"/><path d="M399 221L448 215 465 233 434 236Z" fill="#314e6c"/><path d="M405 224L435 224 427 232 411 231Z" fill="#76eaff" stroke="#cef9ff" stroke-width="2"/><path d="M447 244L488 254 472 258 450 257 440 269 412 260" fill="#13253d"/><path d="M455 245L459 259 466 251M478 253L480 262 486 256" fill="#f1fcff" stroke="#bbdae7" stroke-width="1"/><path d="M409 267L439 294 452 276 463 289 480 272 496 271 471 296 440 309 412 289 381 303" fill="url(#metal)"/><path d="M328 275L367 258 378 270M325 294L366 278 377 291M327 313L368 299 377 309" fill="none" stroke="#c6e7f0" stroke-width="2" opacity=".8"/><path d="M329 247L315 224 343 231M341 225L328 205 356 215" fill="url(#metal)"/></g>';
function dragon(id) {
  let content = '<g stroke="#263e57" stroke-width="3" stroke-linejoin="round">' +
    '<path d="M277 321C210 223 170 105 63 73L112 204 117 310 183 288 249 370Z" fill="url(#wing)"/><path d="M276 325L65 74 159 233 118 308M67 77L185 289M159 234L247 365" fill="none" stroke="url(#metal)" stroke-width="6"/>' +
    '<path d="M334 319C405 212 426 119 548 65L516 195 562 290 473 286 394 369Z" fill="url(#wing)"/><path d="M335 319L548 65 453 231 561 290M546 68L474 285M453 231L394 369" fill="none" stroke="url(#metal)" stroke-width="6"/>' +
    '<path d="M293 364C245 399 180 460 129 430 66 393 47 430 68 469 38 451 27 406 60 389 108 361 143 425 188 396 226 370 239 341 277 333Z" fill="url(#body)"/>' +
    '<path d="M285 276C341 262 383 312 367 374 357 417 312 453 265 447 222 440 204 411 226 378 239 357 239 293 285 276Z" fill="url(#body)"/>' +
    '<path d="M269 298C300 320 327 351 306 394L277 437 318 420 339 388 342 347 315 301Z" fill="url(#metal)"/>' +
    '<path d="M279 311L329 326M284 329L336 344M290 348L338 364M288 368L330 384M280 389L319 403M266 409L301 422" fill="none" stroke="#284760" opacity=".75"/>' +
    '<path d="M259 333L207 352 175 317 151 326 171 341 160 345 183 352 189 375 238 373 270 362M349 336L396 357 426 337 443 346 426 358 449 360 440 374 405 381 351 366" fill="url(#metal)"/>' +
    '<path d="M260 411L223 443 194 485 220 498 250 481 262 459 291 437M328 409L348 452 390 470 410 486 383 498 356 483 321 462 300 438" fill="url(#body)"/>' +
    '<path d="M195 484L181 506 204 498 205 513 222 498 229 507 243 485M384 478L386 501 399 492 413 502 411 483 425 489 412 471" fill="url(#metal)"/>' +
    '<path d="M242 292L224 276 236 312 219 303 225 338M248 283L249 250 268 277" fill="url(#metal)"/></g>';
  if (id === 'ultimate-dragon') {
    content += '<g transform="translate(-152 70) rotate(-27 350 260) scale(.88)">' + dragonHead + '</g><g transform="translate(75 54) rotate(25 350 260) scale(.86)">' + dragonHead + '</g>' + dragonHead;
    content += '<circle cx="440" cy="257" r="54" fill="url(#orb)" opacity=".45"/>';
  } else if (id === 'twin-thunder') {
    content += '<g transform="translate(-119 48) rotate(-18 350 260)">' + dragonHead + '</g><g transform="translate(44 -23)">' + dragonHead + '</g>';
  } else {
    content += dragonHead;
  }
  if (id === 'thunder-dragon' || id === 'twin-thunder') content += '<g fill="none" stroke="#fff1a0" stroke-width="3" opacity=".8"><path d="M59 61L104 174 81 225 152 342 111 379 170 487"/><path d="M533 109L497 205 536 250 465 364 496 422 461 504"/><path d="M209 96L224 139 204 153 238 206"/></g>';
  if (id === 'alexandrite') content += '<g fill="#ffe1ee" stroke="#9c70a9" stroke-width="2"><path d="M244 333L253 310 267 332 255 347Z"/><path d="M242 383L253 368 267 386 254 402Z"/><path d="M363 284L375 264 390 282 375 299Z"/></g>';
  if (id === 'spear-dragon') content += '<path d="M468 244L567 244 496 262Z" fill="url(#metal)" stroke="#43614c" stroke-width="3"/>';
  if (id === 'dragon-champion') content += '<g transform="translate(210 150) scale(.34)">' + warriorBody('gaia') + '</g>';
  return wrap(content, palettes[id], id.length * 63);
}
function magician(id) {
  const girl = id === 'dark-girl';
  const colors = girl ? ['#ffcee6', '#b47abb', '#3c4c87', '#89ecf9', '#202039'] : ['#c3aff4', '#8566b5', '#332455', '#7eeddb', '#15252d'];
  let content = '<g stroke="#291e48" stroke-width="3" stroke-linejoin="round">' +
    '<path d="M260 256C192 279 200 345 140 415L75 502 216 478 268 557 344 516 441 545 398 425 382 284Z" fill="#35274b"/>' +
    '<path d="M229 275L166 480 217 459 268 549 297 390M365 287L407 523 343 493 319 394" fill="url(#body)" opacity=".85"/>' +
    '<path d="M253 414L243 516 223 565 270 568 296 472 304 421M309 421L332 508 332 567 374 567 364 493 350 417" fill="#373651"/>' +
    '<path d="M250 448L279 459 267 543 274 572 216 572 237 541ZM324 452L351 440 365 530 381 570 326 570 333 531Z" fill="url(#metal)"/>' +
    '<path d="M248 254L350 252 381 338 352 420 272 434 223 354Z" fill="url(#body)"/>' +
    '<path d="M262 280L320 306 351 278 366 310 324 336 251 305Z" fill="#6bc2bd" stroke="#b0e5d6" stroke-width="2"/>' +
    '<path d="M247 346L310 374 365 346M259 368L308 392 358 372M268 394L308 410 350 395" fill="none" stroke="#7dd3ca" stroke-width="7"/>' +
    '<path d="M241 254C223 215 188 238 172 270L191 293 228 293 254 276ZM349 254C371 219 402 239 421 268L400 293 365 296 336 276Z" fill="url(#metal)"/>' +
    '<path d="M184 277L153 336 105 347 111 370 177 363 216 303M398 285L426 326 451 300 468 321 435 368 410 355 367 303" fill="url(#body)"/>' +
    '<path d="M111 344L86 331 61 337 83 345 50 352 55 360 81 359 59 372 68 377 97 361 113 369M448 299L446 274 455 269 459 289 467 276 473 282 472 314 459 324" fill="#e9c5bd"/>' +
    '<path d="M260 165L340 165 348 212 324 251 288 245 261 212Z" fill="#d9b6bd"/>' +
    '<path d="M260 179L271 223 281 224 275 174M335 171L338 208 328 239 348 213 355 169" fill="#553875"/>' +
    '<path d="M282 195L298 193 291 199M316 192L332 189 324 198" fill="#182a35"/>' +
    '<path d="M305 199L301 216 309 218M296 228L319 226" fill="none" stroke="#9e708c" stroke-width="2"/>' +
    '<path d="M203 170L222 139 251 125 280 40 310 71 334 120 358 137 379 177 324 196 246 189Z" fill="url(#body)"/>' +
    '<path d="M228 139L277 160 340 146 353 137M221 153L277 175 361 157M247 122L288 138 333 126" fill="none" stroke="#75c9c0" stroke-width="8"/>' +
    '<path d="M279 42L310 111 316 123M238 159L263 179" fill="none" stroke="#d4c5f2" stroke-width="3"/>' +
    '<path d="M449 497L421 142" fill="none" stroke="#395461" stroke-width="16"/><path d="M445 498L417 142" fill="none" stroke="url(#metal)" stroke-width="9"/>' +
    '<path d="M421 158C386 155 375 129 388 105 403 77 430 77 447 99 465 125 449 153 421 158Z" fill="url(#body)"/><circle cx="418" cy="121" r="23" fill="url(#orb)" stroke="#b1f5e7" stroke-width="3"/>' +
    '<path d="M387 115L369 85 399 94M441 94L467 83 451 118" fill="url(#metal)"/></g>' +
    '<circle cx="77" cy="352" r="59" fill="url(#orb)" opacity=".7"/><circle cx="77" cy="352" r="30" fill="none" stroke="#bcfff0" opacity=".8"/><path d="M54 369L78 323 101 369Z" fill="none" stroke="#baffec" opacity=".8"/>';
  if (girl) {
    content = content.replaceAll('#75c9c0', '#efb6d5').replaceAll('#7dd3ca', '#efb6d5');
    content += '<path d="M263 181C230 218 248 261 218 283 255 281 272 250 275 207M339 182C375 209 344 261 381 277 340 280 324 251 332 208" fill="#eccc81" stroke="#98734b" stroke-width="3"/>';
  }
  if (id === 'skilled-magician') content = content.replaceAll('#75c9c0', '#c7a861') + '<g fill="url(#orb)"><circle cx="251" cy="332" r="14"/><circle cx="307" cy="351" r="14"/><circle cx="354" cy="326" r="14"/></g>';
  return wrap(content, colors, id.length * 32);
}
function warriorBody(id) {
  const ox = id === 'battle-ox', stone = id === 'stone-soldier';
  let content = '<g stroke="#253a3e" stroke-width="3" stroke-linejoin="round"><path d="M220 239L168 402 194 533 266 484 374 527 410 400 370 245Z" fill="#273c39"/>' +
    '<path d="M244 397L219 508 199 548 245 548 283 453 296 410M308 407L329 501 328 549 374 549 367 480 352 394" fill="url(#body)"/>' +
    '<path d="M228 246L355 242 386 339 347 421 257 430 211 341Z" fill="url(#metal)"/>' +
    '<path d="M236 271L300 302 357 268 346 340 295 361 241 333Z" fill="url(#body)"/>' +
    '<path d="M256 366L343 363 351 387 258 395Z" fill="#bc9b57"/><path d="M286 365L310 365 315 391 289 391Z" fill="#e9d9a3"/>' +
    '<path d="M220 247L192 255 166 289 190 319 236 291M354 246L387 249 414 280 394 312 350 287" fill="url(#body)"/>' +
    '<path d="M191 299L163 354 138 332 122 351 153 393 178 387 220 315M384 304L421 355 449 316 471 332 436 396 418 389 361 319" fill="url(#metal)"/>' +
    '<path d="M261 151L332 151 350 194 330 230 280 235 253 194Z" fill="#d8b993"/><path d="M263 171L331 170 326 196 270 202Z" fill="#344754"/><path d="M272 183L288 187M310 185L326 180" stroke="#bdf8f0"/>' +
    '<path d="M249 171L260 127 302 109 341 130 354 173 321 160 301 169 279 162Z" fill="url(#body)"/>' +
    '<path d="M290 119L301 78 315 122 309 157 298 167Z" fill="url(#metal)"/><path d="M256 207L239 237 267 251 294 234M330 226L352 251 373 234 347 204" fill="url(#metal)"/>' +
    '<path d="M438 455L455 170" stroke="#cda460" stroke-width="13"/><path d="M454 188L438 157 476 38 493 164 464 190Z" fill="url(#metal)" stroke="#d7e3d2"/><path d="M426 200L481 204" stroke="#caaf69" stroke-width="9"/></g>';
  if (ox) content += '<path d="M268 145C221 146 202 116 207 80 224 113 242 112 278 122M329 123C357 112 382 120 396 80 407 121 378 149 340 146" fill="#ead2a5" stroke="#7a604b" stroke-width="3"/><path d="M458 165C394 147 401 109 427 78L456 89 503 68C539 109 536 158 476 167Z" fill="url(#metal)" stroke="#293c38" stroke-width="4"/>';
  if (stone) content = content.replaceAll('#d8b993', '#819a9e').replaceAll('#bc9b57', '#48686b') + '<g fill="none" stroke="#254044" stroke-width="4"><path d="M260 130L278 160 268 180 283 211M340 150L318 161 333 202M246 280L267 297 255 326M319 295L299 321 319 351M329 419L348 441 338 466"/></g>';
  return content;
}
function warrior(id) {
  const colorMap = {
    'battle-ox': ['#e5c39a', '#aa7959', '#3e3d44', '#dda775', '#202d30'],
    'celtic-guardian': ['#e1eabc', '#77a28c', '#3c635f', '#d1e3a7', '#1d3632'],
    'stone-soldier': ['#c5d9d3', '#859b96', '#37595a', '#afdfd6', '#243738'],
    gaia: ['#bccee4', '#506898', '#283b66', '#d7b97b', '#182b3c'],
    breaker: ['#e8a6a9', '#a4506d', '#3c2847', '#a0e8df', '#261c33'],
    kaibaman: ['#f0f0e6', '#a6bbc5', '#4b657b', '#a6e6fd', '#23323e']
  };
  let body = warriorBody(id);
  if (id === 'gaia') body += '<g transform="translate(-10 35)" fill="url(#body)" stroke="#1c364c" stroke-width="4"><path d="M202 373C168 334 131 345 128 371L81 397 103 420 163 409 183 455 155 531 175 552 210 487 249 486 329 480 360 545 380 545 367 459 339 405 273 411Z"/><path d="M128 356L116 327 143 345M147 359L153 330 166 356M135 386L154 377" fill="#283e5c"/><path d="M218 413L264 456 312 410" fill="#6f2c4c"/></g>';
  if (id === 'kaibaman') body += '<path d="M230 244L181 198 163 227 198 483 277 512 256 375 274 263M334 242L390 187 411 219 384 509 318 491 338 362 316 260" fill="url(#metal)" stroke="#5d8391" stroke-width="4"/><path d="M256 150L301 111 348 147 335 188 300 174 267 189Z" fill="#e4eaf0" stroke="#567588" stroke-width="3"/><path d="M268 163L297 153 331 159 324 172 299 170 275 177Z" fill="#67bde2"/>';
  return wrap(body, colorMap[id] || colorMap.breaker, id.length * 103);
}
function fiend(id) {
  if (id === 'kuriboh') {
    let fur = '<path d="M131 286L107 263 129 230 114 207 152 191 155 158 193 164 214 128 244 146 274 116 306 138 338 117 360 149 404 135 414 172 448 178 446 214 479 232 459 264 478 297 452 319 461 359 425 375 417 412 383 411 365 445 332 431 301 454 273 432 238 451 217 420 177 421 169 383 130 375 139 337 110 319Z" fill="url(#body)" stroke="#523929" stroke-width="5"/>';
    for (let i = 0; i < 10; i++) fur += '<path d="M' + (169 + i * 24) + ' 232l-8 29 17-12-7 27" stroke="#6e523f" stroke-width="3" fill="none" opacity=".35"/>';
    fur += '<ellipse cx="233" cy="302" rx="39" ry="49" fill="#a6b75f" stroke="#402d29" stroke-width="6"/><ellipse cx="363" cy="302" rx="39" ry="49" fill="#a6b75f" stroke="#402d29" stroke-width="6"/><ellipse cx="238" cy="308" rx="21" ry="32" fill="#352c43"/><ellipse cx="358" cy="308" rx="21" ry="32" fill="#352c43"/><circle cx="244" cy="295" r="9" fill="white"/><circle cx="365" cy="295" r="9" fill="white"/><path d="M158 335L100 347 68 377 103 374 87 394 120 382 112 407 150 380M439 335L494 349 528 381 494 372 511 395 474 382 484 406 448 379M217 425L192 468 222 456 231 479 245 440M351 436L369 478 381 455 408 468 383 425" fill="#949963" stroke="#4d5e46" stroke-width="4"/>';
    return wrap(fur, ['#e4c39a', '#a37e62', '#664a3f', '#ccb48b', '#342736'], 78);
  }
  if (id === 'la-jinn') {
    const content = '<path d="M346 554C384 528 432 495 407 454 390 425 319 440 327 400L358 319 389 273 360 236 366 163 307 125 261 159 250 221 221 259 218 328 249 381 284 420C217 476 334 490 313 536Z" fill="url(#body)" stroke="#264e4a" stroke-width="4"/><path d="M269 192L295 202 291 215 270 207M319 202L344 190 344 207 326 215" fill="#e8ec9f"/><path d="M280 235L338 230 316 259Z" fill="#244744"/><path d="M274 170L260 120 289 141M327 140L349 116 346 166" fill="url(#metal)"/><path d="M232 260L181 286 138 239 115 245 128 282 179 331 229 308M373 268L418 294 453 246 480 252 466 287 423 336 376 312" fill="url(#body)" stroke="#204c47" stroke-width="5"/><path d="M285 335L346 335M274 357L340 359" stroke="#183b3b" stroke-width="4"/><path d="M243 544Q291 511 344 538L387 511 364 551 315 571 254 569 226 550 204 559 178 543 196 525 221 533Z" fill="url(#metal)" stroke="#6d6345" stroke-width="3"/>';
    return wrap(content, ['#b6e8bc', '#569c85', '#245652', '#bde897', '#193c3a'], 322);
  }
  let content = '<g stroke="#473346" stroke-width="3"><path d="M239 291L112 159 73 223 87 363 192 323 260 384M344 291L472 139 521 207 525 342 416 320 329 392" fill="#60344e"/><path d="M235 282L185 239 150 257 189 352 227 362 241 440 281 467 333 434 347 351 407 341 438 260 397 239 344 281Z" fill="url(#body)"/><path d="M252 132L305 104 352 135 357 191 337 229 321 253 276 249 258 221 238 195Z" fill="url(#metal)"/><path d="M253 146L202 93 181 116 225 174M344 145L390 85 421 105 376 177" fill="url(#body)"/><path d="M258 176L285 184 281 207 258 195M313 183L342 172 338 194 315 207" fill="#412434"/><path d="M292 198L284 221 309 221Z" fill="#533044"/><path d="M272 233L328 231M280 228L280 243M293 227L293 245M307 227L307 245M319 227L319 242" fill="none" stroke="#5c3b46" stroke-width="3"/><path d="M251 288L303 306 343 284M246 313L303 329 347 310M246 338L302 354 341 335M257 364L303 380 335 359M275 266L295 407 312 421" fill="none" stroke="#4b3749" stroke-width="12"/><path d="M250 426L226 488 199 537 233 547 264 505 291 453M316 446L336 502 374 544 403 524 370 489 354 423" fill="url(#metal)"/><path d="M172 280L115 327 86 403 116 414 150 352 203 315M416 278L461 329 479 403 507 392 493 313 448 263" fill="url(#metal)"/></g><path d="M124 92L179 192 148 233 206 303M491 68L434 178 465 218 414 298" fill="none" stroke="#e1c3fa" stroke-width="5" opacity=".8"/>';
  return wrap(content, ['#ece0d0', '#b4a4a0', '#5a485d', '#d3aaf3', '#271f39'], 247);
}
function magic(id) {
  const colors = ['#d4f5d8', '#71b6a5', '#285d5b', '#a7edd4', '#13392f'];
  let content = '';
  if (id === 'pot-of-greed') content = '<path d="M166 238L150 154 179 146 204 202 232 173 367 173 400 204 426 147 453 155 432 247 451 304 437 401 401 453 333 479 259 475 199 444 161 383 151 306Z" fill="url(#body)" stroke="#1d5146" stroke-width="7"/><ellipse cx="299" cy="182" rx="89" ry="31" fill="#224f45" stroke="#aad3a1" stroke-width="10"/><ellipse cx="299" cy="183" rx="65" ry="17" fill="#102d29"/><path d="M185 262L248 247 273 284 233 293 191 280M324 281L350 246 414 264 400 282 359 294" fill="#f4e29c" stroke="#33584b" stroke-width="6"/><path d="M210 263L232 263 227 289 216 284M368 264L389 264 386 284 371 291" fill="#213c39"/><path d="M291 289L272 331 302 341 327 327 310 289" fill="#9fd2a3" stroke="#356f59" stroke-width="4"/><path d="M187 339C251 369 361 374 417 333L392 396 351 427 290 439 230 422 205 391Z" fill="#eee5b9" stroke="#355747" stroke-width="7"/><path d="M214 351L238 419M254 363L267 434M293 369V438M334 368L323 434M373 356L355 423M191 370C257 400 339 404 410 368" fill="none" stroke="#658b61" stroke-width="4"/><path d="M187 224L221 231M375 231L412 224" stroke="#c6dc9c" stroke-width="9"/>';
  if (id === 'monster-reborn') content = '<ellipse cx="300" cy="464" rx="155" ry="29" fill="#96ead5" opacity=".18"/><g fill="none" stroke="#b8f6e8" opacity=".5"><circle cx="300" cy="300" r="150"/><circle cx="300" cy="300" r="160" stroke-dasharray="7 15"/><path d="M140 300H460M300 140V460"/></g><path d="M271 457V315H205V269H272V227C226 210 215 166 237 125 262 80 328 79 357 118 389 162 378 209 329 227V269H395V315H328V457Z" fill="url(#metal)" stroke="#d8ebaf" stroke-width="5"/><ellipse cx="300" cy="159" rx="30" ry="38" fill="#1a4d4c" stroke="#e9eabb" stroke-width="5"/><path d="M284 245H316V442H284Z" fill="#5bb8ba" opacity=".7"/><circle cx="300" cy="290" r="25" fill="url(#orb)"/>';
  if (id === 'raigeki') {
    colors.splice(0, 5, '#fff6b7', '#d9be63', '#2a4259', '#ffe28b', '#172831');
    content = '<g fill="#fcf2b4" stroke="#ffffda" stroke-linejoin="round"><path d="M363 44L247 229 307 221 205 436 337 279 286 280 406 78Z" stroke-width="6"/><path d="M263 193L165 192 223 258 116 334 165 347 79 473 218 334 177 321 267 256 228 224Z" stroke-width="3"/><path d="M316 303L418 274 402 357 477 376 408 515 441 391 367 380 373 328Z" stroke-width="3"/></g><ellipse cx="272" cy="496" rx="155" ry="29" fill="url(#orb)"/><path d="M85 496L181 445 273 492 361 451 515 511" fill="none" stroke="#d9d68a" opacity=".5" stroke-width="3"/>';
  }
  if (id === 'dark-hole') {
    colors.splice(0, 5, '#d8b2ef', '#975ec9', '#342248', '#cea7ef', '#15162c');
    content = '<g transform="translate(300 293) rotate(-25)"><ellipse rx="220" ry="140" fill="none" stroke="#8c70b3" stroke-width="30" opacity=".16"/><ellipse rx="194" ry="110" fill="none" stroke="#d7c3ef" stroke-width="12" opacity=".7"/><ellipse rx="177" ry="97" fill="#100f21"/><ellipse rx="167" ry="90" fill="none" stroke="#faf0ff" stroke-width="4"/><path d="M-222 27C-60 133 191 85 229-60M-192-112C-80-3 127 76 213-2" fill="none" stroke="#b9a0de" stroke-width="8" opacity=".8"/></g><g fill="#bba5da"><path d="M100 401L130 383 145 413 117 431Z"/><path d="M438 139L468 126 485 163 451 164Z"/><path d="M374 447L400 432 416 456 389 477Z"/></g>';
  }
  if (id === 'fissure') {
    colors.splice(0, 5, '#f4cf9e', '#988476', '#57444a', '#ffb66e', '#3b2e36');
    content = '<path d="M304 96L329 207 270 281 332 346 281 428 310 546" fill="none" stroke="#ffa973" stroke-width="47" filter="url(#glow)"/><path d="M305 92L319 210 269 285 328 349 276 431 310 555" fill="none" stroke="#fff1ad" stroke-width="11"/><g fill="url(#metal)" stroke="#5b4540" stroke-width="4"><path d="M71 206L160 178 263 202 232 252 266 286 204 326 91 290Z"/><path d="M350 179L431 155 524 219 497 274 370 310 305 277 344 229Z"/><path d="M100 337L203 343 281 318 276 372 249 420 127 461 68 418Z"/><path d="M341 364L438 320 514 354 529 423 423 477 313 423Z"/><path d="M179 488L256 448 270 501 244 546 145 543Z"/></g>';
  }
  if (id === 'mst') {
    content = '<g fill="none" stroke-linecap="round"><path d="M142 155C229 62 482 141 473 211 464 279 142 269 127 326 107 402 385 387 389 443 394 487 295 518 285 540" stroke="#9df1e3" stroke-width="17" opacity=".55"/><path d="M133 178C270 115 474 179 426 236 367 306 121 263 146 336 164 389 394 371 360 449 344 483 295 508 289 540" stroke="#d2fff0" stroke-width="7"/><path d="M87 237C110 332 419 274 438 339 451 390 228 425 288 526" stroke="#5da99f" stroke-width="28" opacity=".6"/><path d="M184 128C145 211 359 215 406 262M161 359C145 421 284 407 327 455" stroke="#e5ffdf" stroke-width="4"/></g><g fill="#cbe8cb" opacity=".5"><path d="M138 108L162 98 170 121 149 130Z"/><path d="M431 370L458 354 470 370 450 390Z"/></g>';
  }
  if (id === 'swords') {
    colors.splice(0, 5, '#fff4c8', '#d0b76e', '#376e6d', '#fff0a8', '#1d4043');
    content = '<circle cx="300" cy="338" r="187" fill="none" stroke="#ebe9af" opacity=".35" stroke-width="2"/>';
    for (const [x, y, scale] of [[155, 48, .78], [297, 14, 1.02], [437, 48, .78]]) content += '<g transform="translate(' + x + ' ' + y + ') scale(' + scale + ')"><path d="M0 12V484" stroke="#fffac1" stroke-width="42" opacity=".25" filter="url(#glow)"/><path d="M-13 150V400L0 482 14 400V150Z" fill="url(#metal)" stroke="#fff1b5" stroke-width="3"/><path d="M0 70V160M-56 149L0 138 56 149" fill="none" stroke="#e4d797" stroke-width="15"/><circle cy="53" r="14" fill="#faf1c2"/><path d="M0 173V446" stroke="#ffffe2" stroke-width="3"/></g>';
  }
  if (id === 'polymerization') {
    colors.splice(0, 5, '#ffdcb2', '#d88557', '#4b5f82', '#ecb283', '#192f49');
    content = '<g transform="translate(300 295)"><path d="M0-191C220-190 244 75 73 148 178-15 8-82-50-12-133 87-3 181 79 160-114 277-291 17-126-113-199 58-25 100 45 9 118-83 55-160 0-191Z" fill="#72bfd6" opacity=".9"/><path d="M-1-161C100-133 75-45 7-10-88 39-139-20-125-115-228 81-6 204 125 112 229 40 188-109 67-143 132-60 75 31 4 17-101-5-80-127-1-161Z" fill="#e4a16d"/><path d="M-95-150C-257 30-38 209 123 109M114-142C257 1 63 216-97 118" fill="none" stroke="#f9e8c1" stroke-width="7" opacity=".6"/><circle r="36" fill="url(#orb)"/></g>';
  }
  if (id === 'ancient-rules') content = '<path d="M161 119L432 120 415 420 375 477 139 477 178 415Z" fill="#ceb986" stroke="#745e41" stroke-width="5"/><path d="M167 120C139 115 120 143 138 165L421 163C455 157 456 116 432 114ZM143 438C176 431 179 474 151 480L372 480C405 485 417 451 392 436Z" fill="url(#metal)" stroke="#8e7449" stroke-width="4"/><g fill="none" stroke="#796447" stroke-width="4"><path d="M217 206H368M212 224H372M208 399H356"/><circle cx="288" cy="312" r=" sixty"/></g><circle cx="288" cy="313" r=" sixty" fill="none"/><circle cx="288" cy="312" r="63" fill="none" stroke="#8a7050" stroke-width="3"/><path d="M247 341L259 302 251 275 284 294 306 264 312 297 340 304 318 321 306 351 284 336Z" fill="#9a8056"/>';
  if (id === 'dian-keto') content = '<g fill="url(#metal)" stroke="#4d7c68" stroke-width="3"><path d="M257 265C208 211 156 207 88 235L156 252 101 279 184 291 153 320 243 334M339 265C404 203 460 220 522 241L458 258 508 288 433 298 461 325 353 338" opacity=".8"/><path d="M265 236L228 370 175 498Q302 547 427 498L361 368 330 235Z"/><circle cx="297" cy="188" r="45"/><path d="M260 172L250 125 282 145 300 103 315 146 345 127 337 174Z"/></g><path d="M275 287L295 336 320 288M263 382L297 356 335 382" fill="none" stroke="#f7f4c2" stroke-width="16"/><circle cx="300" cy="314" r="57" fill="url(#orb)"/><ellipse cx="300" cy="113" rx="76" ry="16" fill="none" stroke="#e7edba" stroke-width="4"/>';
  return wrap(content.replaceAll('r=" sixty"', 'r="60"'), colors, id.length * 88);
}
function trapArt(id) {
  const colors = ['#f2c8e3', '#b775aa', '#503451', '#e9a8d3', '#302035'];
  let content = '';
  if (id === 'mirror-force') content = '<g transform="translate(300 300) rotate(14)"><ellipse rx="158" ry="211" fill="url(#metal)" stroke="#edc5e0" stroke-width="7"/><ellipse rx="137" ry="190" fill="#386b82" stroke="#6a425d" stroke-width="9"/><ellipse rx="117" ry="170" fill="#173e59" stroke="#a4dbea" stroke-width="2"/><path d="M-25-166L16-81-12-24 54 7 2 66 30 153M-126 36L-15-21 74-73 121-70M-2 65L-79 135M57 7L122 48" fill="none" stroke="#c9f5ff" stroke-width="6"/><ellipse rx="98" ry="157" fill="none" stroke="#b2e8fa" stroke-width="2" opacity=".5"/><path d="M-5-45L35-14 25 26-31 37-51-11Z" fill="#f3edff"/></g><path d="M322 252L521 123 467 237 547 290 361 321 500 475 305 366 128 517 233 336 76 233 244 274 145 84Z" fill="#a9d9ed" opacity=".18"/>';
  if (id === 'magic-cylinder') content = '<g transform="rotate(-18 300 300)"><path d="M135 210V429Q210 465 270 429V210Z" fill="url(#body)" stroke="#7d466e" stroke-width="5"/><ellipse cx="202" cy="210" rx="68" ry="29" fill="#edb4d2" stroke="#844676" stroke-width="5"/><ellipse cx="202" cy="212" rx="46" ry="17" fill="#40213d"/><path d="M330 123V344Q400 374 465 344V123Z" fill="url(#body)" stroke="#7d466e" stroke-width="5"/><ellipse cx="397" cy="123" rx="68" ry="29" fill="#efd1e3" stroke="#844676" stroke-width="5"/><ellipse cx="397" cy="125" rx="46" ry="17" fill="#40213d"/><path d="M160 308L202 255 244 308 202 361Z" fill="#89bda0" stroke="#ecc697" stroke-width="3"/><path d="M356 217L397 165 440 218 398 271Z" fill="#d1878b" stroke="#ecc697" stroke-width="3"/></g><path d="M206 227C171 148 346 41 385 129" fill="none" stroke="#ffe7c7" stroke-width="17" opacity=".7"/><path d="M201 227C171 148 346 41 389 129" fill="none" stroke="#faffe4" stroke-width="5"/>';
  if (id === 'trap-hole') content = '<ellipse cx="301" cy="356" rx="233" ry="143" fill="#9c618f" opacity=".45"/><ellipse cx="301" cy="356" rx="201" ry="119" fill="#100f1e" stroke="#c28dac" stroke-width="9"/><g fill="url(#body)" stroke="#5c3c55" stroke-width="4"><path d="M67 323L76 265 137 238 183 261 154 299 110 310Z"/><path d="M178 246L244 208 306 228 300 263 256 250 214 271Z"/><path d="M329 227L379 207 447 232 418 284 355 269Z"/><path d="M453 265L501 268 541 327 499 349 474 316Z"/><path d="M463 390L513 361 508 421 449 455 407 432Z"/><path d="M149 410L171 464 233 476 251 448 203 423Z"/><path d="M71 347L115 331 138 371 150 413 99 423 69 388Z"/></g><path d="M229 277L259 394 291 324 334 411 368 278" fill="none" stroke="#d9a5df" stroke-width="6" opacity=".8"/><path d="M298 93L273 136 312 157 290 213" fill="none" stroke="#f7c8ed" stroke-width="11"/>';
  if (id === 'negate-attack') content = '<path d="M299 100L456 162 435 319C425 385 369 452 299 503 218 449 170 386 156 319L137 162Z" fill="url(#body)" stroke="#eec7e8" stroke-width="7"/><path d="M299 132L423 181 408 313C400 365 356 421 299 466 237 420 194 365 184 313L170 181Z" fill="#47456e" stroke="#ce9bd9" stroke-width="4"/><circle cx="298" cy="286" r="83" fill="#734f85" stroke="#e0b5e4" stroke-width="4"/><path d="M252 241L344 333M344 241L252 333" stroke="#eadbed" stroke-width="20" stroke-linecap="round"/><path d="M49 160L187 218 169 183 235 250 153 238 187 223M542 119L410 206 449 196 381 255 406 174 412 205" fill="#eae2f3"/>';
  return wrap(content, colors, id.length * 53);
}
function avatar(kind) {
  const kaiba = kind === 'kaiba';
  let content = '<path d="M91 600L119 430 223 366 372 364 482 427 511 600" fill="' + (kaiba ? '#dce7e5' : '#302d47') + '" stroke="#5b7281" stroke-width="7"/>';
  content += '<path d="M246 299L237 389 297 432 355 384 344 298" fill="#c99f8c"/><path d="M211 173Q302 99 390 180L372 285 342 337 296 359 249 330 215 287Z" fill="#ecc4a3" stroke="#785e63" stroke-width="5"/>';
  if (kaiba) content += '<path d="M189 188L208 116 274 78 359 90 407 152 402 235 374 268 378 181 348 224 330 161 279 219 266 173 222 236 215 276 193 250Z" fill="#523c38" stroke="#2d3034" stroke-width="5"/><path d="M216 129L287 110 358 123M248 148L309 116" stroke="#89604a" stroke-width="7"/>';
  else content += '<path d="M200 298L146 236 183 216 99 146 181 150 134 70 220 104 236 17 286 67 341 8 351 88 451 44 418 133 509 123 442 201 468 248 392 289 378 185 295 201 223 180Z" fill="#282335" stroke="#9c496b" stroke-width="13"/><path d="M214 128L196 97 251 118 256 67 290 126 325 70 323 158 376 128 355 220 326 177 297 224 276 178 237 229Z" fill="#f0ce77" stroke="#c39957" stroke-width="4"/>';
  content += '<path d="M232 246L275 237 264 263 241 263M323 239L365 244 348 264 331 260" fill="#fcf8e7" stroke="#674953" stroke-width="4"/><path d="M254 243L267 241 261 260 253 260M329 243L342 244 341 260 331 259" fill="' + (kaiba ? '#64a5c2' : '#aa6f9f') + '"/><path d="M300 259L292 286 304 290M275 312L323 309" fill="none" stroke="#a07370" stroke-width="4"/>';
  content += kaiba ? '<path d="M216 353L126 280 143 436 255 459 227 389M371 351L465 281 449 438 339 460 362 389" fill="#eef2e4" stroke="#779099" stroke-width="6"/><path d="M254 448L295 428 337 450 367 600H224Z" fill="#263a4a"/>' : '<path d="M231 394L190 506 245 600 344 600 407 507 357 394 299 451Z" fill="#342d42" stroke="#646479" stroke-width="7"/><path d="M226 397L299 530 373 396" stroke="#d5b66d" stroke-width="8" fill="none"/><path d="M265 533L334 533 300 587Z" fill="#d8b86b" stroke="#947244" stroke-width="4"/><path d="M281 547Q300 532 320 547 300 565 281 547" fill="none" stroke="#71532e" stroke-width="3"/>';
  return wrap(content, ['#e1d5bc', '#a5acaa', '#324a53', kaiba ? '#afdbec' : '#dac6a0', '#182d32'], 734);
}
const back = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520"><defs><radialGradient id="b"><stop stop-color="#284137"/><stop offset="1" stop-color="#111e1b"/></radialGradient><linearGradient id="g"><stop stop-color="#c4ae72"/><stop offset=".5" stop-color="#706044"/><stop offset="1" stop-color="#baa366"/></linearGradient></defs><rect width="360" height="520" rx="16" fill="#101a17"/><rect x="8" y="8" width="344" height="504" rx="12" fill="url(#b)" stroke="url(#g)" stroke-width="3"/><rect x="21" y="21" width="318" height="478" rx="5" fill="none" stroke="#89774b" stroke-width="1"/><path d="M28 102V29H102M258 29H331V102M331 418V490H258M102 490H28V418" fill="none" stroke="#b49a61" stroke-width="4"/><g transform="translate(180 260)" fill="none" stroke="#a9925e"><ellipse rx="120" ry="181" opacity=".55"/><ellipse rx="106" ry="164" opacity=".32"/><circle r="92" stroke-dasharray="2 9"/><path d="M0-128L111 63H-111ZM0 128L111-63H-111Z" opacity=".42"/><circle r="66"/><path d="M-59 0Q0-55 59 0 0 55-59 0Z" stroke-width="3"/><circle r="21" stroke-width="3"/><circle r="9" fill="#b39a60"/><path d="M-43 19L-63 61M43 19L62 61M-28 43L-39 67M28 43L39 67" stroke-width="3"/></g><g fill="#c4ac72"><path d="M180 41L187 55 180 69 173 55Z"/><path d="M180 451L187 465 180 479 173 465Z"/></g><text x="180" y="440" text-anchor="middle" fill="#9f8b5c" font-family="Georgia,serif" font-size="12" letter-spacing="7">DUELIST</text></svg>';

for (const card of CARD_LIST) {
  let art;
  if (palettes[card.id]) art = dragon(card.id);
  else if (['dark-magician', 'dark-girl', 'skilled-magician'].includes(card.id)) art = magician(card.id);
  else if (['la-jinn', 'summoned-skull', 'kuriboh'].includes(card.id)) art = fiend(card.id);
  else if (card.type === 'spell') art = magic(card.id);
  else if (card.type === 'trap') art = trapArt(card.id);
  else art = warrior(card.id);
  await writeFile(join(destination, card.id + '.svg'), art);
}
await writeFile(join(destination, 'card-back.svg'), back);
await writeFile(join(destination, 'kaiba.svg'), avatar('kaiba'));
await writeFile(join(destination, 'yugi.svg'), avatar('yugi'));
await writeFile(join(root, 'assets/ARTWORK.md'), '# 卡面素材说明\n\n本目录的所有 SVG 均由 scripts/generate-art.mjs 本地生成，保留完整可编辑路径。没有使用网络下载的原版卡图。\n\n角色、卡牌名称与世界观致敬高桥和希创作的《游戏王》；本项目为非官方学习与同人演示。矢量插画是为本项目重新绘制的风格化演绎。\n\n重新生成：node scripts/generate-art.mjs\n');
console.log('Original SVG artwork ready: ' + (CARD_LIST.length + 3) + ' files.');
