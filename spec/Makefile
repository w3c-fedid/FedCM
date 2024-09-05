.PHONY: all spec idl clean

all: spec idl

spec: index.html

idl: fedcm.idl

fedcm.idl: index.bs
	./extract_idl.rb fedcm.idl

index.html: index.bs
	bikeshed --die-on=fatal spec index.bs

clean:
	rm index.html
	rm fedcm.idl
