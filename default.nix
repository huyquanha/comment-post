with import <nixpkgs> {};
stdenv.mkDerivation rec {
        name = "nodejs";
        buildInputs = [ nodejs ];
}