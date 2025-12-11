# Setup Guide for Public Repository

This document provides instructions for pushing the public repository to GitHub and setting up automatic synchronization.

## 📋 Current Status

The public repository structure has been created in `tigement-public/` with:

✅ Frontend code (Vue 3 + TypeScript) in `frontend/`
✅ Backend code (PHP API) in `backend/`
✅ Documentation (README files)
✅ Configuration examples
✅ .gitignore file
✅ GitHub Action workflow (in private repo)

## 🚀 Step 1: Push to Public Repository

Navigate to the public repository directory and initialize git:

```bash
cd /home/sodomak/clones/tigement/tigement-public

# Initialize git if not already done
git init

# Add the remote repository
git remote add origin https://github.com/Invisible-Infra/tigement.git

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Open source Tigement

- Vue 3 + TypeScript frontend
- PHP REST API backend
- Comprehensive documentation
- Example configurations"

# Push to GitHub
git push -u origin main
```

If the branch is named differently (e.g., `master`), use:
```bash
git push -u origin master
```

## 🔑 Step 2: Create GitHub Personal Access Token

To enable automatic synchronization from your private repository, you need to create a Personal Access Token (PAT):

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name: `Tigement Public Sync`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Set expiration (recommend 90 days or no expiration for automation)
6. Click "Generate token"
7. **Copy the token immediately** (you won't see it again!)

## 🔐 Step 3: Add Secret to Private Repository

Add the token as a secret in your private repository:

1. Go to your private repository: https://github.com/sodomak/tigement
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `PUBLIC_REPO_TOKEN`
5. Value: Paste the Personal Access Token from Step 2
6. Click **"Add secret"**

## ⚙️ Step 4: Verify GitHub Action

The GitHub Action workflow has been created at:
```
.github/workflows/sync-public.yml
```

This workflow will:
- Trigger on push to `main` or `master` branch
- Only run when files in `tigement/` or `api/` directories change
- Automatically sync changes to the public repository
- Exclude test files, node_modules, and config.php

To manually trigger the workflow:
1. Go to your private repository on GitHub
2. Click **Actions** tab
3. Select **"Sync to Public Repository"** workflow
4. Click **"Run workflow"**

## 🧪 Step 5: Test the Synchronization

Test the automatic sync:

1. Make a change to a frontend file in the private repo:
   ```bash
   cd /home/sodomak/clones/tigement
   # Edit a file, for example:
   echo "// Test sync" >> tigement/src/App.vue
   ```

2. Commit and push:
   ```bash
   git add tigement/src/App.vue
   git commit -m "Test: Verify public repo sync"
   git push
   ```

3. Check the GitHub Actions tab in your private repository
4. Verify the changes appear in the public repository

## 📝 What Gets Synced

### ✅ Included in Public Repo
- `tigement/src/` → `frontend/src/` (all Vue components, utils, views)
- `tigement/*.ts` → `frontend/` (config files)
- `tigement/*.json` → `frontend/` (package files)
- `tigement/index.html` → `frontend/`
- `tigement/public/` → `frontend/public/`
- `api/index.php` → `backend/`
- `api/Database.php` → `backend/`

### ❌ Excluded from Public Repo
- Test files (`__tests__/`, `*.spec.ts`)
- `node_modules/`
- `api/config.php` (credentials)
- Docker files
- Environment files
- Database backups
- Any file in `.gitignore`

## 🔄 Manual Sync Process

If you prefer to sync manually instead of using GitHub Actions:

```bash
#!/bin/bash
# Save this as sync-public.sh in your private repo

cd /home/sodomak/clones/tigement

# Sync frontend
rsync -av --delete \
  --exclude='__tests__' \
  --exclude='*.spec.ts' \
  --exclude='node_modules' \
  tigement/src/ tigement-public/frontend/src/

cp tigement/{package.json,package-lock.json,index.html,env.d.ts} tigement-public/frontend/
cp tigement/*.config.ts tigement-public/frontend/
cp tigement/tsconfig*.json tigement-public/frontend/

# Sync backend
cp api/{index.php,Database.php} tigement-public/backend/

# Commit and push public repo
cd tigement-public
git add .
git commit -m "Sync from private repository"
git push origin main
```

Make it executable:
```bash
chmod +x sync-public.sh
```

Run it when needed:
```bash
./sync-public.sh
```

## 🛠️ Maintenance

### Updating Documentation

When you update documentation in the public repo directly:

```bash
cd /home/sodomak/clones/tigement/tigement-public
# Edit README.md or other docs
git add .
git commit -m "docs: Update documentation"
git push
```

### Adding New Files to Sync

If you add new configuration files that should be synced, update:
- `.github/workflows/sync-public.yml` in the private repo
- Add the files to the "Sync frontend files" or "Sync backend files" steps

### Troubleshooting Sync Issues

If the GitHub Action fails:

1. Check the Actions tab for error logs
2. Verify the `PUBLIC_REPO_TOKEN` secret is set correctly
3. Ensure the token has not expired
4. Check file paths in the workflow match your structure

## 📊 Repository Structure

```
Private Repository (sodomak/tigement)
├── .github/workflows/sync-public.yml  ← Sync workflow
├── tigement/                          ← Frontend source
├── api/                               ← Backend source
└── tigement-public/                   ← Local copy of public repo

Public Repository (Invisible-Infra/tigement)
├── frontend/                          ← Synced from tigement/
├── backend/                           ← Synced from api/
├── README.md                          ← Main documentation
├── LICENSE                            ← MIT License
└── .gitignore                         ← Ignore patterns
```

## 🎯 Next Steps

1. ✅ Push the public repository to GitHub
2. ✅ Create and configure the Personal Access Token
3. ✅ Test the automatic synchronization
4. 📝 Add repository description and topics on GitHub
5. 📝 Enable GitHub Pages (optional, for documentation)
6. 📝 Add badges to README (build status, license, etc.)
7. 📝 Create CONTRIBUTING.md guidelines
8. 📝 Set up issue templates

## 🔗 Useful Links

- Private Repository: https://github.com/sodomak/tigement
- Public Repository: https://github.com/Invisible-Infra/tigement
- GitHub Actions Documentation: https://docs.github.com/en/actions
- Personal Access Tokens: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token

## 💡 Tips

- Keep the public repository clean and well-documented
- Review sync logs regularly to catch issues
- Update documentation when adding new features
- Consider adding a CHANGELOG.md for release notes
- Use GitHub Discussions for community questions
- Add a CODE_OF_CONDUCT.md for community guidelines

## ⚠️ Security Reminders

- ❌ Never commit `config.php` or any file with credentials
- ❌ Never commit `.env` files
- ❌ Keep your Personal Access Token secure
- ✅ Review the GitHub Action logs to ensure no sensitive data is synced
- ✅ Use environment variables for all sensitive configuration
- ✅ Regularly rotate your Personal Access Token

