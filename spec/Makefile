DEST=../docs

.PHONY: all spec idl clean

all: spec idl

spec: $(DEST)/index.html

idl: $(DEST)/fedcm.idl

$(DEST)/fedcm.idl: index.bs
	./extract_idl.rb $(DEST)/fedcm.idl

$(DEST)/index.html: index.bs
	bikeshed --die-on=fatal --allow-nonlocal-files spec index.bs
	mv index.html $(DEST)

clean:
	rm $(DEST)/index.html
	rm $(DEST)/fedcm.idl
