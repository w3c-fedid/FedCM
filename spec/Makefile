all: index.html

index.html: Makefile index.bs
	bikeshed --die-on=fatal --allow-nonlocal-files spec index.bs
	mv index.html ../docs
