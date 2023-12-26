#!/usr/bin/env ruby

require 'date'

if ARGV.length < 1
  puts "Filename required"
  exit 2
end

outfile = ARGV[0]

YEAR=DateTime.now.year
HEADER=<<HERE
// Copyright (C) [#{YEAR}] World Wide Web Consortium,
// (Massachusetts Institute of Technology, European Research Consortium for
// Informatics and Mathematics, Keio University, Beihang).
// All Rights Reserved.
//
// This work is distributed under the W3C (R) Software License [1] in the hope
// that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
// warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//
// [1] http://www.w3.org/Consortium/Legal/copyright-software

//
// **** This file is auto-generated. Do not edit. ****
//

HERE

File.open(outfile, 'w') do |f|
  f.puts HEADER

  in_idl = false
  File.open('index.bs').read.split("\n").each do |l|
    if in_idl
      if l =~ /<\/xmp>/
        f.puts
        in_idl = false
      else
        f.puts l
      end
    elsif l =~ /xmp class="?idl/
      in_idl = true
    end
  end
end
