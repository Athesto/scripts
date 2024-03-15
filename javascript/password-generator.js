#!/usr/bin/env node
/*
 * l (letra ele) vs I (mayúscula i) vs 1 (número uno)
 * O (mayúscula o) vs 0 (número cero)
 * 5 (número cinco) vs S (mayúscula ese)
 * 8 (número ocho) vs B (mayúscula be)
 * u (letra u) vs v (letra ve)
 * c (letra ce) vs e (letra e)
 * q (letra cu) vs g (letra ge)
 * 2 (número dos) vs Z (mayúscula z)
 * 9 (número nueve) vs g (letra ge)
 * d (letra de) vs cl (dos letras c y ele)
 * uvceqglIOSBZ12580
 * l1IO0
 */
const lower  = "abcdefghijklmnopqrstuvwxyz"
const upper  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const nums = "1234567890"
const signs = "+_)(*&^%$#@!=*/"
const len = parseInt(process.argv[2])

function randomInt(max){
  return Math.floor(Math.random() * max)
}

let output = ""
const options = lower+upper+nums

for (let i = 0; i < len; i++){
  output += options[randomInt(options.length)]
}

console.log(output)
