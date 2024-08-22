.PHONY: all spec idl clean

all: spec idl

spec: index.html login-status.html

idl: fedcm.idl login-status.idl

fedcm.idl: index.bs
	./extract_idl.rb fedcm.idl

login-status.idl: login-status.bs
	./extract_idl.rb login-status.idl

index.html: index.bs
	bikeshed --die-on=fatal spec index.bs

login-status.html: login-status.bs
	bikeshed --die-on=fatal spec login-status.bs

clean:
	rm index.html
	rm fedcm.idl
	rm login-status.html
	rm login-status.idl
